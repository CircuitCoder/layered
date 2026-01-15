---
title: FIFO on Single Port SRAM
tags: 开发
---

The obvious way to implement a FIFO using SRAM is by using a dual-port SRAM --- one port for reading, one for writing. Dual-port SRAMs are expensive (in multiple senses), so the traditional way is to "emulate" them using multiple banks of single-port SRAMs.

It's also [well known](https://chipress.online/2024/05/05/design-a-sync-fifo-using-single-port-srams/) that since we're specifically implementing a FIFO, the two halves of SRAM accesses have a special pattern, i.e. with the classic banking method through address modulo, **consective accesses from any one of the ports will never land on the same bank** --- they are guaranteed to loop though all banks in order. So instead of using more banks and hope that probability works in our favor, we can mostly get away with only using two banks, with a little bit of write buffering.

- Each cycle, if reading and writing do not involves a bank conflict, do both.
- Else, read has priority, and buffer the write. The buffered write will be guaranteed to not conflict with the reading half in the next cycle.
  - If no read is presented in the next cycle, the write is free to execute.
  - Else, the read will land on the other bank, making it possible to write into this bank.
- Since the buffer is guaranteed to be cleared next cycle, the storage can be bounded to one element, and the combinatory path going into FIFO's push ready signal does not depend on the state of the buffer.

All of these depends on the nice behavior of FIFO's consecutive memory accesses. Let's now try to introduce some other features that can potentially break this nice property.

## Flushing FIFO

Consider a FIFO that allows for a single-cycle flushing operation (clearing all contents). These kind of queues are frequently used in pipelines with speculative executions, where the entire pipeline needs to be discarded (quickly).

This means at least one of the head and tail pointers may snap to a place that does not depend on the previous value, most likely by reseting both pointer into their initial value, which can break the assumption of continous SRAM access.

However in practice it does not matter in this use case. We will also reset the state of the buffer during flush. As long as we do not feed the write address of the *next* cycle into the memory in advance, there is no additional risk of strutural hazard.

## Multi-port FIFO

Multi-port FIFO can read and/or write multiple entries at the same cycle. This is the kind of concurrency that often warrants banking for most storage structures.

To implement a multi-port FIFO, number of banks have to increase. Generally, for a FIFO with $R$ reading ports and $W$ writing ports, $W + R$ banks are required.

**Also, the size of the buffer needs to increase to $\lceil R / W \rceil \times W$.** To show this, consider whether we have more read ports or write ports.

- The easier case is when $R \le W \Rightarrow \lceil R / W \rceil \times W = W$. A conflicting bank is guaranteed to be available for writes nexe cycle, and at most $R$ banks can conflict at each cycle.
- For $R > W$, the situation gets more complicated. Let's first introduce an example. Consider the case $R = 3, W = 2$, assume that initially the buffer and queue is empty, `head = tail = 0`.

 > Let's write down the bank index of the writes, which are consecutive elements in $\mathbb{Z} / 5 \mathbb{Z}$:
 >
 > $$0, 1, 2, 3, 4, 0, 1, 2, 3, 4...$$
 >
 > Similarly, let's write down the bank indexes of **banks that are available for writes for each cycle. Also let's arbitrarily assume that on even cycles there are 3 reads, on odd cycles there is 1 read. To make thinks clearer, we will draw a $\mid-$divider between cycles. <small>cycles start at 0</small>
 >
 > $$3, 4 \mid 4, 0, 1, 2 \mid 2, 3 \mid 3, 4, 0, 1 ...$$
 >
 > At first glance that seems very random, and depends highly on read pattern. However if we write the sequence in each cycle **in reverse**:
 >
 > $$4, 3 \mid 2, 1, 0, 4 \mid 3, 2 \mid 1, 0, 4, 3 ...$$
 >
 > That's exactly $\mathbb{Z} / 5 \mathbb{Z}$ in reverse order.

  In general, the indexes of banks available for writes is $\mathbb{Z} / (W + R) \mathbb{Z}$ in reverse order. That means for each bank, in every $\lceil (W + R) / W \rceil = \lceil R / W \rceil + 1$ cycles, at lease one cycle is available for writes. So each write will at most remain in the buffer for $\lceil R / W \rceil$ cycles, giving us the size bound for the buffer.

> **Remark 1**: The buffer have to be scheduled in an out-of-order fashion, both during enqueuing and executing. But the location for overwriting can be a simple autoincrement counter, because the **upperbound** for retiring time in the buffer is monotonic.

> **Remark 2**: It's possible to reduce this bound to $R$, which may save at most $W - 1$ space. In fact we've already proved this for $R \le W$. However the other part of the proof seems pretty convoluted, and it's possible that I've made some mistake, so that proof will have to wait for another blog post.
>
> We have to relax the "in-order overwriting" for the $R$ bound to work.

<!--
It suffices to prove that the buffer never contains entries with the same bank index. It's possible to have a write presented on the cycle that has the same bank index as one of the entry in the buffer, but it's guaranteed that the 

The index in the segment will increase

max wait time: ceil((R + W) / W) = ceil(R / W)
So buffer size: ceil(R / W) * W -> R? difference: at most W - 1
k dist max: 

3 is not enough: 0 3, 
-->


<details>
<summary>Counterexample for buffer size of only W</summary>
Consider W = 1, R = 3.

- Cycle 0, Write bank 0, Read bank 0, 1, 2. Write gets buffered.
- Cycle 1, Write bank 1, Read bank 3, 0, 1. Previous buffered write still conflicts, new access also conflicts, but buffer is full.
</details>

<details>
<summary>Counterexample for a in-order buffer</summary>
Consider W = 2, R = 1

- Cycle 0, Write bank 0, 1, Read bank 0. Both write gets buffered because the writes operate in a FIFO manner.
- Cycle 1, Write bank 2, 0, Read bank 1. One write from buffer is clear to execute, but one still conflicts. Buffer overflows.
</details>

## Speculative FIFO
Another type of FIFO that takes speculative execution into account are FIFOs that have a separate embedded "committed" state. An additional head pointer denotes the actual committed FIFO head, but reads come from the speculative head location. One separate signal is used to increment the committed head pointer, and another one to indicate that the read pointer should revert to the committed state.

Note the difference between this and the flusing FIFO is that the state needs to be kept. The canonical example for this kind of FIFO is the load/store queue for a in-order LSU with replay.

In this scenario, although buffered writes are not guaranteed to complete next cycle, still at most one writes are block at each cycle. So we only need to allow writes presented at each cycle to schedule independently from the buffer write (i.e. writes out-of-order into the SRAM), which should only require minimal modification.

> **Remark 3**: The original arbiter for each bank already have to consider three data sources (read port, write port, buffered write state). Instead, it's the buffer that needs modification, so that it only update when the request from the write port gets blocked (which necessarily means that current buffered writes is scheduled).

> **Remark 4**: Alternatively, more often than not, the readout data at the exact cycle of reverting does not matter. In this case, we can allow the write to go through. The caveat is that there might already be a buffered write, so the scheduler should be able to schedule two writes at the same cycle.

## What if the SRAM has a non-zero write-to-read bypass latency?

This commonly means that writes to **certain address** cannot be reliably read within some cycles. The easiet way to solve this is by judging the validness of readout data by the tail pointer some cycles ago.

But if the SRAM cannot reliably serve **any** read request within certain cycles of the write, or vice versa? e.g. this is a cursed SDRAM that has a really bad timing and precharge latency of eternality. Assume the latency is $L_W$ and $L_R$ for writes and reads.

Within the latency, the ongoing request should be considered to have exclusive access to that bank. This implies we have to use $L_W + L_R$ banks to have a shot at full pipeline bandwidth, with $L_R$ buffers for writes, and $L_W$ buffers for readout data.
