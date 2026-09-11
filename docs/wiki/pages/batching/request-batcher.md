<!-- m-wiki: type=concept slug=request-batcher topic=batching base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: concept. 0 sources.

# RequestBatcher

`RequestBatcher` manages the lifecycle of one event queue: enqueue, timer-based flush, HTTP dispatch, retry with exponential backoff, and kill-switch on persistent localStorage failure. One instance exists per queue type (`events`, `people`, `groups`).

## Where it applies in this repo

| Symbol | File |
|---|---|
| `RequestBatcher` constructor | `src/request-batcher.js:RequestBatcher` |
| `enqueue` | `src/request-batcher.js:42` |
| `flush` | `src/request-batcher.js:108` |
| `scheduleFlush` | `src/request-batcher.js:91` |
| `reportDeliveryMetric` | `src/request-batcher.js:288` |
| `stopAllBatching` | `src/mixpanel-core.js:661` |

## Why this design

The batcher is constructed with a `storageKey` and an `options` object that includes the parent `MixpanelLib` config reference, a `sendRequest` callback, and optionally `beforeSendHook` and `deliveryMetricsReporter`. This dependency-injection pattern means the batcher never imports Mixpanel core — testable in isolation.

Flush timing is event-driven: a flush fires when (a) `batchSize` items are queued, or (b) `batch_flush_interval_ms` elapses since the last flush. The interval is stored in `flushInterval` and doubles on each retry, capped at `MAX_RETRY_INTERVAL_MS` (10 minutes).

## Related

- [Shared Lock](shared-lock.md)
- [Event Delivery Pipeline](../03-EVENT-DELIVERY.md)
- [Delivery Metrics Reporter](../delivery-hooks/delivery-metrics-reporter.md)

## Sources

_(no raw sources)_

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Wiki index](../../index.md)

<!-- atomic: keep this page ≤600 words. New scope → new concept page that builds on this one. Do not append paragraphs here. -->
