<!-- m-wiki: type=concept slug=shared-lock topic=batching base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: concept. 0 sources.

# SharedLock

`SharedLock` is a distributed mutex implemented on top of `localStorage`. It prevents simultaneous writes to the event queue from multiple browser tabs open on the same origin.

## Where it applies in this repo

| Symbol | File |
|---|---|
| `SharedLock` constructor | `src/shared-lock.js:SharedLock` |
| Lock acquire/release | `src/request-queue.js:46` |
| Queue fill under lock | `src/request-queue.js:84` |

## Why this design

When multiple tabs are open, each tab's `RequestBatcher` runs its own flush timer. Without coordination, two tabs could simultaneously read the same batch from localStorage, send it, and both try to remove the same items — causing double-removes and potential data loss.

The lock uses three `localStorage` keys (`<queueKey>:X`, `<queueKey>:Y`, `<queueKey>:Z`) following the Alur-Taubenfeld distributed algorithm adapted for two-process mutual exclusion. Polling interval is 100 ms plus random jitter to reduce thundering-herd on contention.

**Timeout:** If the lock cannot be acquired within 2 seconds (e.g., because a tab crashed mid-write and left stale lock state), the lock is forcibly broken and the write proceeds. This prevents permanent deadlock at the cost of a small risk of concurrent writes on tab crash.

## Related

- [RequestBatcher](request-batcher.md)
- [Persistence & Storage](../04-PERSISTENCE.md)

## Sources

_(no raw sources)_

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Wiki index](../../index.md)

<!-- atomic: keep this page ≤600 words. New scope → new concept page that builds on this one. Do not append paragraphs here. -->
