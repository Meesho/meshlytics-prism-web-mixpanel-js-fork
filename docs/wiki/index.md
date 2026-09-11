# meshlytics-prism-web-mixpanel-js-fork — Wiki

> Synthesized view of this codebase. Code is the prior; this wiki is downstream.
> Owned by `m-wiki`. Edit via skills, not directly.

## Top-level pages

| #   | Page | What you'll learn |
|-----|------|-------------------|
| 01 | [Overview](pages/01-OVERVIEW.md) | What the fork is, architecture diagram, module map |
| 02 | [API Surface](pages/02-API-SURFACE.md) | Full public API: init, track, identify, people, groups, GDPR |
| 03 | [Event Delivery Pipeline](pages/03-EVENT-DELIVERY.md) | How events flow from track() to HTTP and back |
| 04 | [Persistence & Storage](pages/04-PERSISTENCE.md) | Super-props, distinct_id, queue storage, multi-tab lock |
| 05 | [Meesho Customizations](pages/05-MEESHO-CUSTOMIZATIONS.md) | The 4 Meesho-specific changes on top of upstream |

## Topics

### batching (2 pages)

- [RequestBatcher](pages/batching/request-batcher.md) — Flush loop, retry, exponential backoff, kill-switch
- [SharedLock](pages/batching/shared-lock.md) — Distributed localStorage mutex for multi-tab coordination

### delivery-hooks (1 page)

- [Delivery Metrics Reporter](pages/delivery-hooks/delivery-metrics-reporter.md) — Hook schema, reason codes, try-catch contract

### gdpr (1 page)

- [GDPR Opt-In/Out](pages/gdpr/opt-in-out.md) — Consent state storage and enforcement per token

### release (1 page)

- [Build & Release Cycle](pages/release/build-release-cycle.md) — dist/ committed, version bump, Ringmaster pipeline

## How to read this wiki

**If you're brand new:**
Start with [Overview](pages/01-OVERVIEW.md) to understand the fork's purpose, then [API Surface](pages/02-API-SURFACE.md) for the tracking API.

**If you're debugging:**
Start at [Event Delivery Pipeline](pages/03-EVENT-DELIVERY.md) to trace a missed event, then check [Delivery Metrics Reporter](pages/delivery-hooks/delivery-metrics-reporter.md) for reason codes.

**If you're adding a feature:**
Read [Meesho Customizations](pages/05-MEESHO-CUSTOMIZATIONS.md) first to understand the existing hook pattern, then [RequestBatcher](pages/batching/request-batcher.md) for how the flush path works.

## Unexplored topics

Candidates the bootstrap identified but did not generate pages for. Good ingest targets:

- `src/dom-trackers.js` — Link/form DOM tracking wrappers (`FormTracker`, `LinkTracker`)
- `src/utils.js` — UUID generation, cookie/localStorage drivers, browser info collection
- `src/api-actions.js` — Action builders shared by people and group modules

## Operating this wiki

| Action | How |
|---|---|
| Add a source | `/m-wiki:wiki-ingest <path-or-url>` |
| Ask a question | `/m-wiki:wiki-query "<question>"` |
| Health-check | `/m-wiki:wiki-lint` |

---

<!-- m-wiki: index-version=1 generated-at=2026-09-11T00:00:00+00:00 base-sha=19b2bed8917f -->
