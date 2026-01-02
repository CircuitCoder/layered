---
title: A race condition in QReadWriteLock
tags: 开发
---

A few weeks ago [@shankerwangmiao](https://github.com/shankerwangmiao) brought me on a magical journey to debug [a race condition in `QReadWriteLock`](https://qt-project.atlassian.net/browse/QTBUG-142321). The [fix](https://codereview.qt-project.org/c/qt/qtbase/+/696526) will be live in the v6.11.0 release. Although @shankerwangmiao has done most of the actual debugging and fixing, I got the right to brag about it in a blog post. So here is a post about how to write a reader-writer lock, and the cursed nature of weak memory ordering.

## The buggy behavior

Sometimes, [a heavily contended `QReadWriteLock`](https://codereview.qt-project.org/c/qt/qtbase/+/696526/12/tests/auto/corelib/thread/qreadwritelock/tst_qreadwritelock.cpp#607) fails to guarantee the wanted semantics of exclusive access. A reader might find itself running concurrently with a writer, and two writers might run together as well.

When looking inside the state of `QReadWriteLock`, it seems that sometimes the internal state of the lock is corrupted and inconsistent. It sometimes shows that there are negative numbers of readers or writers. That can explain why the lock fails: it does not realize that there are some live accesses.

Curiously, the bug only happens on ISAs with weaker memory ordering than TSO, such as AArch64. On these architectures, semantics of TSO can mostly be recovered by annotating everything with acquire and release ordering. So it hints that the bug is caused by insufficient strength of some memory accesses' ordering, which results in a race condition that loses some updates to the internal state of the lock.

## The anatomy of a reader-writer lock

In contrast to the ubiquitous mutex lock (or `unique_lock` for the C++ folks out there), a reader-writer lock allows two levels of concurrency control: unique access for writers, and shared readonly access for readers. [`QReadWriteLock`](https://doc.qt.io/qt-6/qreadwritelock.html) is Qt's cross-platform implementation of the reader-writer lock. Other common implementations on various platforms are:

- [`RwLock`](https://doc.rust-lang.org/std/sync/struct.RwLock.html) in Rust
- [`std::shared_lock`](https://en.cppreference.com/w/cpp/thread/shared_lock.html) in C++
- [`pthread_rwlock_*`](https://man7.org/linux/man-pages/man3/pthread_rwlock_trywrlock.3p.html) on POSIX w/ pthread.

The implementation of `QReadWriteLock` is quite interesting. It primarily depends on the Qt's platform-independent encapsulation of the unique mutex and condvar. To speed up reader-heavy workloads a `QReadWriteLock` has two states:

- A "thin" state, where there are no waiting threads. In this state, the only data a lock needs to keep track of is the number of concurrent accessing threads, and their access types. [`QReadWriteLock` encodes it as a `size_t`](https://github.com/qt/qtbase/blob/4eb4462b14cc8065e098412d9dd8a1ade90897e2/src/corelib/thread/qreadwritelock.cpp#L19-L29):
  - `0x0` represents no live access.
  - `0x2` represents a live exclusive access.
  - `0x1 | (num_access << 4)` represents some shared exclusive accesses.
- A "heavy" state, where there are waiting threads. Since the waiting is implemented with underlying condvars, another `QReadWriteLockPrivate` struct is allocated to keep track of all the extra data, and `QReadWriteLock` stores its pointer.

With some `reinterpret_cast` magic, the QReadWriteLock is basically a `size_t` integer in both cases <sup>[1]</sup>. When the lock remains in the "thin" state, which is on the fast path, all locking and unlocking is done through a simple atomic CAS operation, directly operating on the integral state <sup>[2]</sup>. Whenever the lock needs to transfer into / out of the "heavy" state, an actual mutex is used to protect the atomicity during the modification of the state of the lock itself. When the bug happens, the inconsistent state can be found in the "heavy" state.

In essence, `QReadWriteLockPrivate` struct stores the following data:

```cpp
struct QReadWriteLockPrivate_is_basically {
  size_t num_reader, num_writer, num_reader_waiting, num_writer_waiting;
  mutex *actual_mutex;
  condvar *read_waiting, *write_waiting;
};
```

The `actual_mutex` protects the lock state, i.e. gets locked whenever some thread tries to read or write the `QReadWriteLockPrivate` object. <strong>It does not get held by the process which held the macroscopic `QReadWriteLock`</strong>, which allows the lock to transfer back into a "thin" state at the earliest possible moment, which is very neat and smart.

Therefore, the pseudo-code for [locking `QReadWriteLock`](https://github.com/qt/qtbase/blob/4eb4462b14cc8065e098412d9dd8a1ade90897e2/src/corelib/thread/qreadwritelock.cpp#L192) is:

```cpp
void lock(QReadWriteLock lock, bool exclusive) {
  while(true) {
    cur_state = lock.state.load(relaxed);
    if (lock is thin and compatible with requested exclusiveness) {
      new_state = lock_thin_incr(cur_state, exclusiveness);
      if (lock.state.cas(cur_state, new_state)) return;
      continue;
    }

    if (lock is thin) {
      // Needs to transfer into "heavy" state, allocate new lock and set
      // inner state based on the current "thin" state
      QReadWriteLockPrivate *heavy = alloc_heavy_lock(cur_state);
      if (!lock.state.cas(cur_state, reinterpret_cast<size_t>(heavy))) {
        // "thin" state changed, try again
        dealloc_heavy_lock(heavy);
      }
      continue;
    }
    
    // Now lock is guaranteed to be "heavy"

    // Naively (but incorrectly), we would do:
    QReadWriteLock *heavy = reinterpret_cast<QReadWriteLock *>(cur_state);
    lock_guard guard = heavy->actual_mutex.lock();
    heavy->lock(exclusive);
  }
}
```

The unlocking side is analogous.

However, the above implementation is incomplete. It turns out, there are *two* more obvious problems with the above pseudo-code's handling of the "heavy" state.

## Looking into the pointer

In order to lock the `actual_mutex`, we have to look into the pointer of a `QReadWriteLockPrivate`. Although all mainstream CPU architectures (with the notable exception of Alpha) guarantee dependency ordering, C++ standard explicitly allows compilers to reorder memory accesses even though they carry dependencies.

The weakest order that can preserve dependency ordering is to use the infamous `std::memory_order_consume` to load the pointer. cppreference.com has a [nice summary](https://en.cppreference.com/w/cpp/atomic/memory_order.html#Release-Consume_ordering) of the caveats of `std:memory_order` with this kind of pointer-mediated communication. Since `std::memory_order_consume` is deprecated, we will use `std::memory_order_acquire` to reload the pointer, and guarantee that we look into the pointer after we read the pointer itself.

```cpp
// Better
cur_state = lock.state.load(std::memory_order_acquire);
if (cur_state is thin) continue;

QReadWriteLock *heavy = reinterpret_cast<QReadWriteLock *>(cur_state);
lock_guard guard = heavy->actual_mutex.lock();
heavy->lock(exclusive);

// ... but some how still wrong
```

## Deallocating the lock under our feet

Since the "heavy" state is on the slow path, what's actually happening is that we first read the `QReadWriteLock` state, check if it's "heavy", and then lock its `actual_mutex`. During this time, the state of the lock may have changed, potentially caused by another thread allocating / deallocating this "heavy" lock.

As such, the handling of the "heavy" state is [implemented more carefully](https://github.com/qt/qtbase/blob/4eb4462b14cc8065e098412d9dd8a1ade90897e2/src/corelib/thread/qreadwritelock.cpp#L236-L247). Instead of the naive code above, additional checks are added to make sure the lock is still in the "heavy" state, and more importantly, the same "heavy" lock object after we lock it:

```cpp
// Even better
cur_state = lock.state.load(std::memory_order_acquire); // (1)
if (cur_state is thin) continue;

QReadWriteLock *heavy = reinterpret_cast<QReadWriteLock *>(cur_state);
lock_guard guard = heavy->actual_mutex.lock();
if (lock.state.load(std::memory_order_relaxed) != cur_state) { // (2)
  guard.unlock(); // Or let RAII do its thing
  continue;
}
heavy->lock(exclusive); // (3)
```

## The race

... Unfortunately, there is still a hidden race condition here. To see why, we have to first look into how are the "heavy" locks allocated and deallocated.

Qt keeps [a pool of pre-allocated "heavy" locks](https://github.com/qt/qtbase/blob/4eb4462b14cc8065e098412d9dd8a1ade90897e2/src/corelib/thread/qreadwritelock.cpp#L561-L562) to speed up the allocation. So "heavy" locks can be reused, or even placed back into the same `QReadWriteLock`. However, even if we don't use the pool, there's still a possibility that the libc allocator may return the same address for a newly allocated "heavy" lock.

Now it seems that it won't be a problem, since the same "heavy" lock always corresponds to the same `actual_mutex`, so we retain exclusive access. That would be the case if we're running on a TSO architecture. Unfortunately, on a WMO architecture, the branch condition may get delayed until after we modify the content of the "heavy" lock (i.e. `heavy->lock(exclusive);`). So the actual sequence of events may be:

$$
(1) \rightarrow (3) \rightarrow (2)
$$

And between (1) and (2), other threads may have deallocated and reallocated the same "heavy" lock object, and placing it back into the same `QReadWriteLock` we are trying to lock.

... And the `alloc_heavy_lock` procedure assumes exclusive access to the `QReadWriteLockPrivate` object (with good reason), and [did not lock `actual_mutex` when initializing the content of `QReadWriteLockPrivate`](https://github.com/qt/qtbase/blob/4eb4462b14cc8065e098412d9dd8a1ade90897e2/src/corelib/thread/qreadwritelock.cpp#L213-L226), so the modification by one side of the race can be lost. We finally arrived at the race condition:

```
Thread A: (1) load heavy lock pointer
Thread B: dealloc heavy lock, place back into pool
Thread A: lock actual_mutex
=== Race starts
Thread C: alloc heavy lock, initialize data
---
Thread A: (3) modify heavy lock data
=== Race ends
Thread C: place heavy lock back into QReadWriteLock
Thread A: (2) check heavy lock pointer didn't change
```

## The fix

There are two possible fixes. The patch went for the lighter one, which is to simply change the relaxed load in (2) to an acquire load. This is sufficient to order (3) after the initialization of the "heavy" lock in the allocating thread.

Alternatively, we can force the allocating thread to lock `actual_mutex` during the entire initialization and CAS operation (the placement of the "heavy" lock into `QReadWriteLock`). Therefore holding `actual_mutex` is sufficient to guarantee that the initialization has completed and is visible.

---

<div class="footnotes">

- [1]: To make sure the two states don't get confused, `alignof(QReadWriteLockPrivate) >= 4`
- [2]: CAS suffers from the ABA problem, but we're fine with it <strong>if the lock remains "thin" </strong><del>subtle foreshadowing</del>. In some sense, the result of each kind of state change only depends on the previous state (or "pure"), so as long as the compare and swap is atomic, the state is consistent.

</div>