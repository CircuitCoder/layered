---
title: Time traveling with relaxed atomics
tags: 微架构
---

Several days earlier, [@dram](https://dram.page/) showed me [this piece of C++ code from the WG21 paper P3292R0](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2024/p3292r0.html#early-escape) that is "miscompiled" by both G++ and Clang++, and convinced me that it does not actually happen on RISC-V. The essence of the code is the following:

```cpp
int *foo(int *q) {
    /*(0)*/ int *p = new int;

    /*(1)*/ *p = 123;
    /*(2)*/ *q = 456;
    /*(3)*/ assert(*p == 123);

    /*(4)*/ return p;
}
```

Surprisingly **this assertion can fail**, because it's possible for `p == q`. The problem is that we can use another thread to send the pointer "back in time":

```cpp
std::atomic<int *> AtoB, BtoA;
void threadA() {
    /*(5)*/ int *q = BtoA.load(relaxed);
    /*(6)*/ int *p = foo(q);
    /*(7)*/ AtoB.store(p, relaxed);
}

void threadB() {
    /*(8)*/ int *ptr = AtoB.load(relaxed);
    /*(9)*/ BtoA.store(ptr, relaxed);
}
```

Observing `p == q` inside foo does not break any lifetime or memory order restriction, and does not involve any UB (unlike an unsynchronized racing condition). Notice that crucially, reading the value of `p` in `void threadA()` (in order to store it into `AtoB`) only depends on the operations caused by the `new` operator, thus remains unordered with the assignment `*p = 1;`.

Even assuming MCA, the only "happens-after" chains we can deduce, in the case that `p == q`, are:

`(0)` -> `(4) == (6)` -> `(7)` -> `(8)` -> `(9)` -> `(5)` -> `(1)` -> `(2)` -> `(3)`

There is no loop and no contradiction, so this is a perfectly fine candidate execution.

## The miscompilation

Essentially both G++ and Clang++ figure that `p != q` and do constant propagation such that `*p == 123` becomes `true`.

I initially thought that this is not a miscompilation, or calling it one is a little bit too harsh. After all, the predominant part of all possible candidate executions will result in `p != q`, and getting `p == q` would require some really weird hardware shenanigans as we will see later.

But during the writing of this post, I noticed that:
- the property of `p == q?` can be checked by other means. So this optimization introduces potential inconsistencies.
- More importantly, **there is no UB at play here**. Most of the time such concurrency problems would require some kind of racing. But there is none here.

Since there is no UB, and potential for an inconsistency situation, the implementation cannot freely optimize this single expression into covering only *SOME* of the possible outcomes. So this is indeed a miscompilation.

## The hardware

How is this possible from the hardware perspective? The obvious possibility is value prediction, but that's only for the architectures with the weakest memory models. It seems that no other viable microarchitecture optimization would result in this behavior.

<details>
<summary>Well Ackchyually🤓, if you try hard enough...</summary>
...You can get a somewhat sane architecture that does this.

The end target is to let `(7)` happens-before `(5)`. Note that a simple "commit early after point-of-no-return" does not work because `(2)` needs the value of `q` to decide whether to exception, so `(7)` cannot be committed before `(5)`.

So we have to assert that on this particular architecture, the memory exceptions are imprecise, or no memory exception is present (e.g. without MMU and memory protection). Combined with "commit early after PNR", we can potentially observe `(7)` happening before `(5)`.

That architecture in theory can produce the desired result, but with very low probability, because inter-core coherence is rather slow. Another architectural feature we can consider is SMT. In uarch with combined store buffer (which promptly breaks MCA), the store only has to commit to the store buffer for the other thread to see.
</details>

However, AArch64 memory model does allow this behavior<sup>[1]</sup>. This is one of the sad examples where the memory model disconnects with current hardware behaviors.

In comparison, RISC-V forbids this. RISC-V specifically has a kind of rule (pipeline dependency) to forbid this kind of behavior (ppo rule 13 to be more concrete). It explicitly forbids `(7)` to commit before the address of `(2)` being ready, which is after `(5)`. This is actually a rare case of pipeline dependency being useful (as designed), and essentially dictates that all hardware implementations should not commit stores which are younger than memory accesses with unresolved addresses.

As a side note, although looking similar to the OOTA (Out-of-thin-air) problem, these two scenarios are fundamentally different, as there is no read-from loop in this case. In contrast, the OOTA problem is already forbidden in all MCA architectures, but RISC-V requires an additional pipeline dependency.

## The crab language

Since this was a C++ problem, it's obligatory to talk about 🦀Rust🦀.

General Rust is not interesting. You can just pass around raw pointers between threads with static global atomics, and get the same result. In that case, also no UB is present (all pointers are "alive" during accesses). So deep down, this is an LLVM bug.

Talking about safe Rust is more interesting. To be precise, safe Rust is `rustc` + `std` + other safe code. It seems that in safe Rust, we also cannot produce this kind of scenario, but the chain is broken at a different place.

It turns out safe Rust *really* hates to pass references to other threads with **relaxed** operations. It boils down to the fact that passing references by relaxed order means that the other thread may not even see the memory being initialized. So the only safe way to pass references across threads is through [Mutexes](https://godbolt.org/z/fdjec6d53), which induces an acquire-release pair. If `(7) -> (8) -> (9) -> (5)` establishes an acquire-release chain, `(0)` has to happen before itself, which is not possible.

But Rust only needs the changes to *referenced memory* being visible on the other thread. But current ISAs don't provide such fine-grained memory ordering primitives, so Rust doesn't have more fine-grained APIs (e.g. similar to OnceCell, allocate and send), and it just happens that it also forbids this problem from happening in safe Rust.

<div class="footnotes">
[1] Both ARM and INRIA's herd-www are broken at the moment, so all I can say is "trust me bro".
</div>