<!-- m-wiki: type=concept slug=delivery-metrics-reporter topic=delivery-hooks base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[docs/tribal-knowledge.md] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: concept. 1 source.

# Delivery Metrics Reporter

The `deliveryMetricsReporter` hook is a Meesho addition to `RequestBatcher` that notifies consumers of every terminal event-delivery outcome. It allows Meesho's monitoring infrastructure (`web-meshlytics` or similar) to measure event loss without this library importing or depending on any specific monitoring backend.

## Where it applies in this repo

| Symbol | File |
|---|---|
| Hook storage on construction | `src/request-batcher.js:RequestBatcher` |
| Invocation | `src/request-batcher.js:288` |
| Config key | `src/mixpanel-core.js:DEFAULT_CONFIG` |

## Why this design

Mirrors the `error_reporter` callback already present in upstream mixpanel-js. The fork never imports the reporter implementation — consumers inject a function at `mixpanel.init()` time. A try/catch wrapper at `src/request-batcher.js:288` ensures a reporter that throws can never propagate into the flush path.

### Callback schema

```javascript
{
    type:   'success' | 'retry' | 'drop',
    count:  <integer>,   // number of events in the batch
    reason: string | undefined,
    status: number | undefined,
    queue:  'events' | 'people' | 'groups'
}
```

### Reason codes by type

| `type` | `reason` | Trigger |
|---|---|---|
| `success` | `undefined` | 2xx response |
| `retry` | `HTTP_5XX` | Status ≥ 500 |
| `retry` | `HTTP_429` | 429 Too Many Requests |
| `retry` | `TIMEOUT` | Elapsed ≥ `batch_request_timeout_ms` |
| `retry` | `PAYLOAD_TOO_LARGE_SPLIT` | 413 with batch size > 1 (halve and retry) |
| `drop` | `PAYLOAD_TOO_LARGE` | 413 with single-event batch |
| `drop` | `HTTP_4XX` | 4xx other than 413/429 |
| `drop` | `OFFLINE` | status ≤ 0 + `navigator.onLine === false` |
| `drop` | `BLOCKED_STATUS0` | status ≤ 0 + browser online (likely CSP/firewall block) |
| `drop` | `KILL_SWITCH` | localStorage removal failed > 5 times consecutively |

## Related

- [Request Batcher](../batching/request-batcher.md)
- [Meesho Customizations](../05-MEESHO-CUSTOMIZATIONS.md)

## Sources

- `docs/tribal-knowledge.md`

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Wiki index](../../index.md)

<!-- atomic: keep this page ≤600 words. New scope → new concept page that builds on this one. Do not append paragraphs here. -->
