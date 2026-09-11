<!-- m-wiki: type=top-level slug=overview topic=null base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[docs/tribal-knowledge.md] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: top-level. 1 source.

# Overview

`meshlytics-prism-web-mixpanel-js-fork` is Meesho's fork of the Mixpanel JavaScript browser SDK (`mixpanel-browser`). It adds delivery-observability hooks, removes a sendBeacon duplication bug, and hardens the batching subsystem against localStorage failures — all without breaking API compatibility with the upstream library. Consuming repos import the package under the same name (`mixpanel-browser`) from Meesho's internal GCP Artifact Registry.

## TL;DR

- Tracks user events and profiles across Meesho's web frontends (supplier portal, affiliate, checkout, etc.)
- Ships as an npm library — no servers, no containers
- Four Meesho-specific changes on top of upstream `mixpanel/mixpanel-js` (v3.1.2)
- Merged to `main` → Ringmaster publishes to GCP Artifact Registry automatically

## Mental model

```
Consumer (affiliate-web, supplier_platform_container, ...)
    │
    │  npm install mixpanel-browser  ← resolved from Meesho GCP Artifact Registry
    ▼
mixpanel.init(token, config)        ← sets up batchers, persistence, GDPR state
    │
    │  mixpanel.track('Event', props)
    ▼
RequestBatcher (per queue type)     ← enqueues to localStorage-backed queue
    │
    │  flush() on timer or size threshold
    ▼
HTTP POST → api-js.mixpanel.com/track    ← events land in Mixpanel
    │
    └─► deliveryMetricsReporter()   ← Meesho hook: success / retry / drop
```

## Structure / data flow

| Module | File | Role |
|---|---|---|
| Entry point | `src/mixpanel-core.js` | `MixpanelLib` class; all public APIs |
| Batching | `src/request-batcher.js` | Flush loop, retry, kill-switch |
| Queue | `src/request-queue.js` | localStorage-backed in-memory queue |
| Multi-tab lock | `src/shared-lock.js` | `SharedLock` mutex on localStorage |
| Persistence | `src/mixpanel-persistence.js` | Super-props, distinct_id, event timers |
| People | `src/mixpanel-people.js` | `/engage` endpoint API |
| Groups | `src/mixpanel-group.js` | `/groups` endpoint API |
| GDPR | `src/gdpr-utils.js` | Opt-in/out enforcement |
| DOM tracking | `src/dom-trackers.js` | Link / form click wrappers |
| Utilities | `src/utils.js` | UUID, cookie/localStorage drivers, DOM |
| API actions | `src/api-actions.js` | `$set`, `$add`, `$union` action builders |

## Key code locations

| What | Where |
|---|---|
| `MixpanelLib` initialization | `src/mixpanel-core.js:226` |
| Default config map | `src/mixpanel-core.js:DEFAULT_CONFIG` |
| `track()` public entry | `src/mixpanel-core.js:778` |
| Batcher flush loop | `src/request-batcher.js:108` |
| Delivery metrics hook | `src/request-batcher.js:288` |

## Sharp edges

- `dist/` is committed. Run `npm run build-dist` and commit it before opening a release PR; forgetting this is the most common mistake.
- sendBeacon is intentionally disabled (`src/mixpanel-core.js:76`). Do not re-enable without verifying duplicate-event fix upstream.
- After 5 consecutive localStorage removal failures, the entire batching subsystem disables itself (`src/request-batcher.js:225`). Events revert to synchronous XHR.
- No automated browser tests in CI. Run `npm run integration_test` manually before releasing request-path changes.

## Related concepts

- [Request Batcher](batching/request-batcher.md)
- [Delivery Metrics Reporter](delivery-hooks/delivery-metrics-reporter.md)
- [GDPR Opt-In/Out](gdpr/opt-in-out.md)
- [Build & Release Cycle](release/build-release-cycle.md)

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Previous](../index.md) · [Index](../index.md) · [Next →](02-API-SURFACE.md)
