---
title: Inotify was (or is) fundamentally racy
tags: 开发
---

This has nothing to do with the common implementation of recursive watches: when adding watches for dynamically created directories, there is indeed a small time window where events under that directory are lost. But if our filesystem scanner's behavior is idempotent, and can tolerate duplicate / out-of-order event delivery (which is also possible under multiple watches), then we can re-do a full scan under that directory _after_ we successfully added the watch.

This post also does not deal with symlinks and hard links.

No. What we're talking about is the unfortunate effect due to inotify's two weird behaviors: it can reuse watch descriptors (WDs), and it can **voluntarily** unwatch something for you. In certain cases, we're completely unsure about whether a certain path is watched.

All "maps" mentioned from now on are "partial maps", which can be stored in a hash map. So we can ask if the map "has a key".

## Delayed event delivery

Inotify events don't have a full path in them. To distinguish events from different watches, inotify uses a watch descriptor in the event to relate the event to a specific watch. WD gets returned when we first add a watch, and is used for distinguishing event sources, and also for removing watches.

Inotify has multiple buffers along the event delivery pathway:
- There is an in-kernel buffer (/proc/sys/fs/inotify/max_queued_events)
- Most likely, applications use a large buffer to read multiple available events at once to avoid excessive syscalls.

Therefore there is immediately a race between `inotify_rm_watch` and `read` (or `epoll` or `select` or `uring` or whatever). Right after we `rm` a watch, we can still receive events from that watch in a small time window. If during this time window, we invoked `inotify_add_watch`, and kernel decided to hand back the reused WD, then we have no way of distinguishing which of the paths an event with this WD actually relates to.

Inotify solves this problem by returning an `IN_IGNORED` event when a watch with some WD is removed. With the FIFO per WD nature of event delivery, we can pretend the WD is still related to the old path until we process (in-order) the `IN_IGNORED` event.

What we need to keep track of is a mapping `WD -> queue<path>`. The queue is a list of paths that are related to this WD in the timespan between the currently processed event (logically, at some time point in the past), and the kernel's mapping at wall-clock (exactly the present).
- Whenever we add a watch and see a new WD, we push the path to the queue.
- Whenever we see a `IN_IGNORED` event, we pop a path from the queue.

So far, so good.

## Voluntarily unwatching

However, kernel can also voluntarily unwatch a path for us. For example, a parent got unmounted, or deleted.

This creates a little problem.

When we call `inotify_add_watch` on a path, if a path is already watched, it will return its old WD. But we will have absolutely no idea whether this is a **new** watch, or the same old watch that was already there.

So assume we sequentially watch on `/a` twice, which both returns `WD = 1`. Somewhere in the future, we receive a `IN_IGNORED(WD = 1)`. What's the state of `/a`? This is important because we need to know whether to push `/a` into the queue. (i.e. do we expect a new `IN_IGNORED` event for it in the future?)

IMO, this stems from the fact that `inotify_add_watch` does not return a boolean indicating whether this is a new watch or not.<sup>[2]</sup>

As far as I can think of, there are a few ways to solve this, each with some unavoidable downside. Somehow, this race is fundamental. The best way seems to be using a new enough kernel (>=4.18), and sacrifice some backward portability (the method 3 below.)

### 1. Never add a watch on a path if we think it can be still watched

This is the standard practice.

Additionally keep a mapping `path -> WD`, which contains the **superset** of the reverse WD mapping **at present**. If we see a `path` in there, we never try to add a new watch on it. This way, each `inotify_add_watch` must correspond with a new watch.
- Gets allocated whenever we actually add a watch on a path
- Deallocated when the "last" element in the `WD -> queue<path>` mapping changes. This happens in two cases:
  - The queue only has 1 element and is getting popped. This indicates that the last holder of this WD's removal is confirmed by the kernel.
  - The queue is non-empty and gets pushed a new path (i.e. a new path gets this WD from the kernel). This indicates that we must have been unwatched by the kernel voluntarily, and the WD gets reused.

This mapping is a **superset** of the actual present state because of the kernel's voluntary unwatching.

This also gives us the ability to remove watches _by path_. A nice property of the `path -> WD` map is that it's **one-to-one**. So we never risk removing someone else.

The problem with this approach is that sometimes we might think we have a watch, but we really don't. Since `inotify` operates on path, not fd, but underlying kernel watches things by `inode`, if a path's `inode` changes, it might eventually cause us to keep some path permanently unwatched.

Consider if a path is deleted and immediately recreated, and we watch both it and its parent. This will create two streams of events:
- `IN_DELETE_SELF -> IN_IGNORED` for the inode of the old path.
- `IN_DELETE -> IN_CREATE / IN_MODIFY` for the parent inode.

Kernel is allowed to deliver these events in this order:

`IN_DELETE_SELF -> IN_DELETE -> IN_CREATE / IN_MODIFY -> IN_IGNORED`

During the processing of `IN_CREATE`, we get the path from `concat(map[wd], ev.name)`, but we don't know whether this path is watched. Looking at our reverse mapping, we see that this path is still watched, so we don't add a new watch, but actually this inode is never watched. This leaves this new path permanently unwatched.

In theory, we can see that this is a `DELETE_SELF` or `CREATE` and perform special bypass for these. But in practice we will have to write a lot of special case handling regarding `DELETE`s and `CREATE`s, try to somehow form a coherent picture of the state of the filesystem in userspace, while dealing with out-of-order event deliveries between watches.<sup>[1]</sup>

## 2. Assert that no WD is reused

In practice this is a good idea. WD allocation is cyclic `[1 .. INT_MAX]`, so the practical chance of a transient `WD` reuse is small.

The `WD -> queue<path>` map degenerates to `WD -> path`, and upon seeing a WD that's already mapped to a path, just panic.

## 3. Check-then-watch

The problem with method 1 is that we tried to implement a check-then-watch procedure, but our decision has some false-positive.

We've mentioned that we actually have a way of telling whether a path is watched.
- We can just unwatch with the WD we think it still holds, see if it's `-EINVAL`, and re-add it. This way we'll actually lose events between this small window.
- We can use `IN_MASK_CREATE` in `inotify_add_watch` <sup>[2]</sup>.

However `IN_MASK_CREATE` is still unsatisfying in the following ways:
- If the kernel already maps an **inode**, it will just outright return an error, and does not tell you the current WD. So the reverse map is still needed.
- Now for every visible new directory, we always try to add a new watch, which causes a syscall.
- Requires a _relatively_ new kernel (>= 4.18). There are still a few Linux distro releases kept on enterprise life support that use older kernels.

---

<div class="footnotes">

- [1] For example, even after `DELETE_SELF`, some event may still fire on that WD: unlink doesn't mean the inode is gone, and there is also the problem with open fds.
- [2] Kernel >= 4.18 has `IN_MASK_CREATE` to try to resolve this: it atomically checks if an **inode** is actively being watched or not, and only modifies / adds the watch if the precondition is met.

  This certainly helps. But the unfortunate thing this causes is that the API does not atomically return an **inode**. So we still have no idea of the real one-to-one mapping between **path <-> WD**.

  And we also cannot switch to **inode -> WD**. Checking `path -> inode` in a separate syscall will also race with fs modification.

</div>
