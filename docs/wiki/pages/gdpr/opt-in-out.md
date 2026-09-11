<!-- m-wiki: type=concept slug=opt-in-out topic=gdpr base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: concept. 0 sources.

# GDPR Opt-In/Out

The library persists user tracking consent state per Mixpanel token and enforces it at every `track()`, `people.*`, and `alias()` call. Opt-out state survives page reloads; clearing it requires an explicit `clear_opt_in_out_tracking()` call.

## Where it applies in this repo

| Symbol | File |
|---|---|
| `optIn` / `optOut` / `hasOptedIn` / `hasOptedOut` | `src/gdpr-utils.js:optIn` |
| Enforcement wrapper | `src/gdpr-utils.js:addOptOutCheckMixpanelLib` |
| `_gdpr_init` | `src/mixpanel-core.js:1588` |

## Why this design

Every public tracking method is wrapped by `addOptOutCheckMixpanelLib` at definition time, not at call time. This means the opt-out check is unconditional and cannot be bypassed by passing unusual arguments. If the user has opted out, the wrapper returns `undefined` immediately before any state is read or modified.

Opt state is stored under the key `__mp_opt_in_out_<token>` using whichever storage type is specified by `opt_out_tracking_persistence_type` (default `localStorage`). Each Mixpanel token gets its own opt state — a consumer using two tokens (e.g., staging vs. production) must manage consent for each independently.

`opt_out_tracking_by_default: true` in `init()` config makes the library behave as if opted-out until the user explicitly calls `opt_in_tracking()`. Useful for regions with opt-in-first legal requirements.

## Related

- [API Surface](../02-API-SURFACE.md)
- [Meesho Customizations](../05-MEESHO-CUSTOMIZATIONS.md)

## Sources

_(no raw sources)_

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Wiki index](../../index.md)

<!-- atomic: keep this page ≤600 words. New scope → new concept page that builds on this one. Do not append paragraphs here. -->
