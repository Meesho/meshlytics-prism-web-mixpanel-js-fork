# Tribal Knowledge — meshlytics-prism-web-mixpanel-js-fork

Non-obvious decisions and gotchas for engineers working on this fork.

---

## Why this fork exists

Meesho uses Mixpanel for product analytics across its web frontends. Rather than
importing the upstream `mixpanel/mixpanel-js` directly, Meesho maintains this fork
(`meshlytics-prism-web-mixpanel-js-fork`) to add instrumentation hooks that the
upstream library does not provide, and to ship targeted bug-fixes that are not
worth upstreaming.

The fork publishes the same npm package name (`mixpanel-browser`) to Meesho's
internal GCP Artifact Registry, so consuming repos need only point their registry
at Meesho's registry to pick up the fork transparently.

---

## Key Meesho-specific changes (not in upstream)

### 1. sendBeacon removed to fix event duplication (`f95503a`)

The upstream library's `sendBeacon` transport path caused duplicate events to be
delivered under certain page-unload conditions. Meesho removed the entire
`sendBeacon` flow from `mixpanel-core.js` as the simplest reliable fix. If upstream
ever ships a clean fix for this, revisit whether to re-enable.

### 2. Dependency-injected `delivery_metrics_reporter` hook (`c986a06`)

`RequestBatcher` now accepts an optional `deliveryMetricsReporter` callback
(passed via `options.deliveryMetricsReporter`). The reporter is called with
`{type, reason, count, status}` at every terminal branch of the flush callback:
success (2xx), drop (4xx / single-event 413 / status≤0 = OFFLINE or BLOCKED),
and retry (5xx / 429 / timeout / 413-split).

This hook mirrors the pattern already used for `error_reporter` in the upstream
library: the fork never imports or depends on the reporter implementation.
Consumers (e.g. `web-meshlytics`) inject a reporter function at `init()` time
so they can measure delivery loss without coupling this library to any specific
monitoring backend.

The call is wrapped in try/catch so a reporter error can **never** break the
send path. Do not remove the try/catch.

### 3. Exit-flush for tail-loss recovery (flag-gated off by default, `58fe90e`)

A page-unload exit-flush was added to recover events that would otherwise be
lost when users close the tab mid-session. It is gated off by default because
reliable page-unload flush behavior varies across browsers. Enable per-consumer
by passing `exit_flush: true` in the `mixpanel.init()` config.

### 4. localStorage resilience (`12ac49f`, `b23be05`)

The batching subsystem now disables itself after a configurable number of
consecutive storage-removal failures. This prevents runaway retry loops when
localStorage becomes unavailable (e.g. private browsing, quota exceeded).
Error-handling was also added for the edge case where localStorage stops
accepting writes after events are already queued but not yet flushed.

---

## Build and release

### dist/ is committed — this is intentional

The compiled `dist/` artifacts are committed to the repo. Ringmaster's library
pipeline reads from `dist/` rather than running a build step during publish.
**Always run `npm run build-dist` and commit the updated `dist/` before opening
a release PR.** Forgetting this is the most common release mistake.

### Version bumping

Bump the `version` field in `package.json` **before** merging to `main`.
Ringmaster keys the published artifact on the version string; merging without a
bump will silently publish over the previous version in the registry, which can
cause stale-cache issues for consumers.

### Release pipeline

Merging to `main` triggers Ringmaster's `publish_node_package` pipeline:
1. Runs `npm run build-dist` (as a sanity check; should match committed dist)
2. Publishes the package to `meesho-devops-admin-0622` GCP Artifact Registry
3. Notifies `#sentry-kaizen` channel on failure

There is no staging publish — every merge to `main` goes straight to the
registry used by production frontends.

---

## Testing

Unit tests cover the custom Meesho hooks:
- `tests/unit/delivery-metrics-hook.test.js` — asserts correct `{type, reason,
  count, status}` per response branch for the `deliveryMetricsReporter` hook.

Run tests: `npm test` (lint + unit). Browser integration tests require starting
`npm run integration_test` and visiting `localhost:3000/tests/`.

There are no automated browser integration tests in CI. The integration test
suite must be run manually before cutting a release that changes request-path
logic.

---

## Syncing from upstream

There is no automated upstream-sync process. When Meesho-specific changes are
small, cherry-pick them onto the new upstream tag. When upstream changes are
large, do a `git merge upstream/master` and resolve conflicts by preserving the
Meesho-specific files in `src/` listed in the changelog above.

The Meesho-specific source changes are confined to:
- `src/mixpanel-core.js` — passes `deliveryMetricsReporter` + `queueType` to each `RequestBatcher`
- `src/request-batcher.js` — implements the hook and localStorage resilience

Keep a note of the upstream commit hash the fork was last rebased onto; that
context lives in the PR description rather than a file.

---

## Consumers

Known internal consumers: `supplier_platform_container`, `affiliate-web`.
Other Meesho web frontends may also depend on this package; search the
internal registry for `mixpanel-browser` dependents before making
breaking changes.
