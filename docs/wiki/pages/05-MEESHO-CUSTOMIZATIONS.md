<!-- m-wiki: type=top-level slug=meesho-customizations topic=null base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[docs/tribal-knowledge.md] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: top-level. 1 source.

# Meesho Customizations

Four targeted changes differentiate this fork from upstream `mixpanel/mixpanel-js`. All are backwards-compatible at the API level — consumers that do not configure the new options see identical behavior to upstream.

## TL;DR

1. **Delivery metrics reporter** — optional callback that reports event-loss outcomes without coupling this library to any monitoring backend
2. **sendBeacon removed** — upstream sendBeacon transport caused duplicate events on page unload
3. **localStorage resilience** — batching disables itself after 5 consecutive removal failures to prevent runaway retries
4. **Exit-flush (flag-gated off)** — page-unload flush for tail-loss recovery, disabled by default

## Mental model

```
Upstream mixpanel-js
    │
    ├─ [fix] sendBeacon code path commented out
    ├─ [feat] deliveryMetricsReporter callback injected at init()
    ├─ [feat] consecutiveRemovalFailures kill-switch
    └─ [feat] exit_flush flag (gated off)
    │
    ▼
meshlytics-prism-web-mixpanel-js-fork (v3.1.2)
```

## Structure / data flow

### 1. Delivery metrics reporter (`c986a06`)

`RequestBatcher` accepts `options.deliveryMetricsReporter` — a callback injected via `mixpanel.init()`. It is called at every terminal branch of the flush response handler:

```javascript
deliveryMetricsReporter({
    type:   'success' | 'retry' | 'drop',
    count:  <number of events in the batch>,
    reason: 'HTTP_5XX' | 'HTTP_429' | 'HTTP_4XX' | 'TIMEOUT' |
            'OFFLINE' | 'BLOCKED_STATUS0' | 'PAYLOAD_TOO_LARGE' |
            'PAYLOAD_TOO_LARGE_SPLIT' | 'KILL_SWITCH' | undefined,
    status: <HTTP status code or undefined>,
    queue:  'events' | 'people' | 'groups'
})
```

The call is wrapped in try/catch at `src/request-batcher.js:288` — a reporter error never propagates into the flush path. Mirrors the `error_reporter` pattern already in upstream.

### 2. sendBeacon removal (`f95503a`)

The upstream `sendBeacon` transport path fired on `pagehide` and `visibilitychange` events and caused duplicate events under certain page-unload conditions. The entire block is commented out at `src/mixpanel-core.js:76`. The `sendBeacon` variable is declared but never assigned.

### 3. localStorage resilience (`12ac49f`, `b23be05`)

`RequestBatcher` tracks `consecutiveRemovalFailures`. After each successful `removeItemsByID()`, the counter resets to 0. After each failure it increments. When the count exceeds 5, `stopAllBatching()` is called and a `drop` + `KILL_SWITCH` metric fires.

This prevents runaway retry loops when localStorage becomes permanently unavailable (quota exceeded, private browsing mode, security policy).

### 4. Exit-flush (`58fe90e`, flag-gated off)

Passing `exit_flush: true` in the `init()` config enables a page-unload flush that attempts to drain the event queue before the page closes. Disabled by default because page-unload flush reliability varies across browsers. Do not enable without verifying browser support for target audiences.

## Key code locations

| What | Where |
|---|---|
| Reporter injection at init | `src/request-batcher.js:RequestBatcher` |
| `reportDeliveryMetric` implementation | `src/request-batcher.js:288` |
| sendBeacon disabled | `src/mixpanel-core.js:76` |
| Kill-switch counter | `src/request-batcher.js:225` |

## Sharp edges

- The reporter callback receives `reason=undefined` on success (2xx) — this is intentional; success has no reason code.
- Do not remove the try/catch around `deliveryMetricsReporter()` — a reporter that throws would break the flush loop.
- The kill-switch is irreversible within a page session. Once batching is stopped, only a page reload re-enables it.

## Related concepts

- [Delivery Metrics Reporter](delivery-hooks/delivery-metrics-reporter.md)
- [Request Batcher](batching/request-batcher.md)
- [Event Delivery Pipeline](03-EVENT-DELIVERY.md)
- [Build & Release Cycle](release/build-release-cycle.md)

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Previous](04-PERSISTENCE.md) · [Index](../index.md) · [Next →](../index.md)
