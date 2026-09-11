<!-- m-wiki: type=top-level slug=persistence topic=null base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: top-level. 0 sources.

# Persistence & Storage

The library writes to two independent storage surfaces: `MixpanelPersistence` (session state: super-props, distinct_id, timers) and the `RequestQueue` (event payloads awaiting delivery). Both use cookie or localStorage, configurable independently.

## TL;DR

- Super-properties and identity are stored in `mp_<token>_mixpanel` (cookie or localStorage)
- Event queues are stored in `mp_<token>_requests_<queueType>` (localStorage only)
- `SharedLock` prevents simultaneous writes from multiple tabs to the queue
- Orphaned queue items (left by crashed tabs) are auto-recovered on next flush

## Mental model

```
┌─────────────────────────────────────────────────────────┐
│  MixpanelPersistence  (per-instance state)              │
│  Key: mp_<token>_mixpanel                               │
│  Contains: distinct_id, $device_id, super-props,        │
│            event timers, alias, referrer, UTM params    │
│  Storage: cookie (default) or localStorage              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  RequestQueue  (event delivery buffer)                  │
│  Key: mp_<token>_requests_events (+ _people, _groups)   │
│  Contains: [{id, flushAfter, payload}, ...]             │
│  Storage: localStorage only (requires XHR too)          │
│  Coordination: SharedLock for multi-tab safety          │
└─────────────────────────────────────────────────────────┘
```

## Structure / data flow

### MixpanelPersistence

Loaded once in `_init()`, saved after any mutation. Reserved property keys (prefixed with `__`) hold library metadata:

| Key | Purpose |
|---|---|
| `distinct_id` | Current user identity |
| `$device_id` | Stable anonymous device ID (UUID set on first load) |
| `__alias` | Alias mapping for `alias()` |
| `__timers` | Pending `time_event()` start timestamps |
| `__mps` | Queued people operations (set/add/etc.) |
| `__mpso` | Queued people set-once operations |

Super-properties (registered via `register()`) are stored alongside these keys. They are merged into every `track()` call before enqueuing.

### RequestQueue

Each queue entry is a JSON object:

```json
{ "id": "<uuid>", "flushAfter": <timestamp_ms>, "payload": { ... } }
```

`flushAfter` = wall-clock time after which the item is considered orphaned if still present. On `fillBatch()`, items with `flushAfter < now` that aren't in the current flush are orphaned — treated as available for any tab to pick up.

### SharedLock (multi-tab coordination)

Before any write to the queue, `SharedLock` acquires a mutex on three localStorage keys (`<queueKey>:X`, `<queueKey>:Y`, `<queueKey>:Z`) using the Alur-Taubenfeld distributed algorithm. If acquisition times out after 2 s (e.g. another tab crashed mid-write), the lock is broken and the write proceeds.

## Key code locations

| What | Where |
|---|---|
| Persistence initialization | `src/mixpanel-persistence.js:MixpanelPersistence` |
| Super-props load/save | `src/mixpanel-persistence.js:84` |
| UTM / referrer capture | `src/mixpanel-persistence.js:222` |
| Queue enqueue | `src/request-queue.js:46` |
| Batch fill + orphan recovery | `src/request-queue.js:84` |
| SharedLock acquire | `src/shared-lock.js:SharedLock` |

## Sharp edges

- Changing `persistence` from `'cookie'` to `'localStorage'` mid-session loses existing super-properties — they're in a different key namespace. Coordinate across all consumer apps before switching.
- Cookie storage is shared across subdomains when `cross_subdomain_cookie: true` (the default). Events from different Meesho subdomains that use the same token will share identity.
- `disable_persistence: true` removes all cookie/localStorage writes — the user gets a new anonymous ID on every page load, and super-props are not saved between sessions.

## Related concepts

- [Request Batcher](batching/request-batcher.md)
- [Shared Lock](batching/shared-lock.md)
- [GDPR Opt-In/Out](gdpr/opt-in-out.md)

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Previous](03-EVENT-DELIVERY.md) · [Index](../index.md) · [Next →](05-MEESHO-CUSTOMIZATIONS.md)
