<!-- m-wiki: type=top-level slug=event-delivery topic=null base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: top-level. 0 sources.

# Event Delivery Pipeline

Events travel from `track()` through a localStorage-backed batch queue to the Mixpanel HTTP API. The pipeline handles retries, backoff, and multi-tab coordination. Meesho adds a `deliveryMetricsReporter` hook at every terminal branch so consumers can measure delivery loss without coupling to a monitoring backend.

## TL;DR

- `track()` enqueues events to a per-queue-type `RequestBatcher` (events, people, groups)
- Each batcher flushes on a timer (default 5 s) or when the batch reaches 50 events
- Flush outcomes are classified as `success`, `retry`, or `drop` — all routed through `reportDeliveryMetric()`
- 5xx / 429 → exponential backoff; 4xx (non-413/429) → drop; 413 → split batch; status ≤ 0 → drop (offline/blocked)
- After 5 consecutive localStorage removal failures: kill-switch disables all batching

## Mental model

```
track('Event', props)
    │
    ├─ [opted-out?] → no-op
    ├─ [batch_requests=false] → sendRequest() immediately (XHR)
    └─ [batch_requests=true]
           │
           ▼
    RequestBatcher.enqueue(item)
           │
           └─ RequestQueue.enqueue()   ← writes to memory + localStorage
                                         SharedLock serializes multi-tab writes
           │
    [timer: 5000ms or batchSize=50 reached]
           │
           ▼
    RequestBatcher.flush()
           │
           ├─ RequestQueue.fillBatch() ← memory + orphaned localStorage items
           ├─ beforeSendHook(payload)  ← optional transform
           └─ sendRequest(data, cb)    ── HTTP POST → /track
                   │
         ┌─────────┴──────────┬────────────────────┐
         │                    │                    │
    success (2xx)      retry (5xx/429/TO)    drop (4xx/offline)
         │                    │                    │
  removeFromQueue      scheduleFlush(backoff)  removeFromQueue
  reportMetric         reportMetric            reportMetric
  ('success')          ('retry')               ('drop')
```

## Structure / data flow

### Three batcher instances

`init_batchers()` (called from `_init`) creates one `RequestBatcher` per queue type:

| Batcher | localStorage key prefix | Endpoint |
|---|---|---|
| events | `mp_<token>_requests_events` | `/track` |
| people | `mp_<token>_requests_people` | `/engage` |
| groups | `mp_<token>_requests_groups` | `/groups` |

Each batcher is independent — a people flush failure does not block an events flush.

### Retry and backoff

On 5xx or 429, the batcher doubles `flushInterval` (exponential backoff), capped at 10 minutes. For 429, it also reads the `Retry-After` header and respects it. Backoff resets on the next successful flush.

413 (Payload Too Large) with batch size > 1: halve the batch size and retry immediately. If a single-event batch returns 413, the event is dropped.

### Kill-switch

`consecutiveRemovalFailures` tracks how many times in a row `removeItemsByID()` has failed. At 6 failures, `stopAllBatching()` is called — all three batchers stop, future `track()` calls fall through to direct (non-batched) XHR. This prevents runaway retry loops when localStorage becomes permanently unavailable (quota exceeded, private mode).

## Key code locations

| What | Where |
|---|---|
| Batcher initialization | `src/mixpanel-core.js:615` |
| Track → batcher routing | `src/mixpanel-core.js:713` |
| Flush loop + response handler | `src/request-batcher.js:108` |
| Kill-switch logic | `src/request-batcher.js:225` |
| Queue fill + orphan recovery | `src/request-queue.js:84` |
| Multi-tab lock | `src/shared-lock.js:SharedLock` |
| Delivery metric reporting | `src/request-batcher.js:288` |

## Sharp edges

- sendBeacon is disabled (`src/mixpanel-core.js:76`). Page-unload flushing is only available via the `exit_flush: true` config flag, which is not enabled by default.
- Orphaned queue items (items whose `flushAfter` timestamp has elapsed, e.g. left by a crashed tab) are picked up by the next tab's `fillBatch()`. De-duplication is server-side.
- If `batch_requests` is disabled (localStorage or XHR not supported), every `track()` fires an immediate XHR — no queue, no retry logic.

## Related concepts

- [Request Batcher](batching/request-batcher.md)
- [Shared Lock](batching/shared-lock.md)
- [Delivery Metrics Reporter](delivery-hooks/delivery-metrics-reporter.md)

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Previous](02-API-SURFACE.md) · [Index](../index.md) · [Next →](04-PERSISTENCE.md)
