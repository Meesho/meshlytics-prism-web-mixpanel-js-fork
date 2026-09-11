<!-- m-wiki: type=top-level slug=api-surface topic=null base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: top-level. 0 sources.

# API Surface

`MixpanelLib` exposes all public methods on the `mixpanel` global (or named instance). The library is API-compatible with upstream `mixpanel/mixpanel-js`; consumers need no code changes to switch to the Meesho fork.

## TL;DR

- `init()` is the only required call; it sets up persistence, batchers, and GDPR state
- `track()` is the hot path — every call is checked for opt-out before enqueuing
- `people.*` and `get_group().*` mirror `track()` but route to `/engage` and `/groups` endpoints
- Super-properties are persisted in cookie/localStorage and merged into every event automatically

## Mental model

```
mixpanel.init(token, config)
    │
    ├─ mixpanel.identify(userId)       ← link events to known user
    ├─ mixpanel.register({key: val})   ← super-props attached to every event
    │
    ├─ mixpanel.track('Event', props)  ← the primary tracking call
    │
    ├─ mixpanel.people.set({...})      ← update user profile
    ├─ mixpanel.set_group('co', id)    ← assign user to group
    └─ mixpanel.opt_out_tracking()     ← GDPR opt-out
```

## Structure / data flow

### Initialization

| Method | Signature | Purpose |
|---|---|---|
| `init` | `init(token, config?, name?)` | Initialize SDK — must call before any other method |
| `_init` | `_init(token, config, name)` | Internal setup: batchers, persistence, GDPR, UUID |
| `set_config` | `set_config(config)` | Merge config after init |
| `get_config` | `get_config(key)` | Read a config value |

Key config keys accepted at `init()`:

| Key | Default | Effect |
|---|---|---|
| `api_host` | `https://api-js.mixpanel.com` | Event delivery endpoint |
| `batch_requests` | `true` | Enable localStorage-backed batching |
| `batch_size` | `50` | Flush when batch reaches this count |
| `batch_flush_interval_ms` | `5000` | Periodic flush interval |
| `persistence` | `'cookie'` | `'cookie'` or `'localStorage'` |
| `opt_out_tracking_by_default` | `false` | Require explicit opt-in |
| `delivery_metrics_reporter` | `undefined` | Meesho hook — see [Delivery Metrics Reporter](../delivery-hooks/delivery-metrics-reporter.md) |

### Event tracking

| Method | Signature |
|---|---|
| `track` | `track(event_name, properties?, options?, callback?)` |
| `track_pageview` | `track_pageview(page?)` |
| `track_links` | `track_links(selector, event_name, properties?)` |
| `track_forms` | `track_forms(selector, event_name, properties?)` |
| `track_with_groups` | `track_with_groups(event_name, properties, groups, callback?)` |
| `time_event` | `time_event(event_name)` |

`track()` is wrapped by `addOptOutCheckMixpanelLib` — it silently no-ops if the user has opted out.

### Identity

| Method | Signature |
|---|---|
| `identify` | `identify(distinct_id, options?)` |
| `alias` | `alias(alias, original?)` |
| `get_distinct_id` | `get_distinct_id()` |
| `reset` | `reset()` |

### Super-properties (persisted per session)

| Method | Signature |
|---|---|
| `register` | `register(props, days?)` |
| `register_once` | `register_once(props, default_value?, days?)` |
| `unregister` | `unregister(prop, options?)` |
| `get_property` | `get_property(name)` |

### People (user profiles → `/engage`)

| Method | Signature |
|---|---|
| `people.set` | `people.set(prop, value?)` |
| `people.set_once` | `people.set_once(prop, value?)` |
| `people.unset` | `people.unset(prop)` |
| `people.add` | `people.add(prop, delta)` |
| `people.append` | `people.append(prop, values)` |
| `people.union` | `people.union(prop, values)` |
| `people.remove` | `people.remove(prop, value)` |

### Groups (group profiles → `/groups`)

| Method | Signature |
|---|---|
| `set_group` | `set_group(group_key, group_ids)` |
| `add_group` | `add_group(group_key, group_id)` |
| `remove_group` | `remove_group(group_key, group_id)` |
| `get_group` | `get_group(group_key, group_id)` |

### GDPR

| Method | Purpose |
|---|---|
| `opt_in_tracking` | Allow tracking (default if not set) |
| `opt_out_tracking` | Disable tracking, clear cookies |
| `has_opted_in_tracking` | Check current opt-in state |
| `has_opted_out_tracking` | Check current opt-out state |
| `clear_opt_in_out_tracking` | Reset opt state |

## Key code locations

| What | Where |
|---|---|
| `track()` implementation | `src/mixpanel-core.js:778` |
| `_init()` implementation | `src/mixpanel-core.js:226` |
| `identify()` implementation | `src/mixpanel-core.js:1231` |
| GDPR wrapper | `src/gdpr-utils.js:addOptOutCheckMixpanelLib` |
| People actions | `src/mixpanel-people.js:MixpanelPeople` |
| Group actions | `src/mixpanel-group.js:MixpanelGroup` |
| Action builders | `src/api-actions.js` |

## Sharp edges

- Calling `track()` before `init()` silently no-ops — the instance has no token or batchers yet.
- `identify()` should be called once per session, after login. Repeated calls with the same ID are safe but calling with a new ID mid-session merges events ambiguously.
- `people.set()` automatically attaches referrer and browser properties; avoid setting `$initial_referrer` manually.

## Related concepts

- [Event Delivery Pipeline](03-EVENT-DELIVERY.md)
- [Persistence & Storage](04-PERSISTENCE.md)
- [GDPR Opt-In/Out](../gdpr/opt-in-out.md)

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Previous](01-OVERVIEW.md) · [Index](../index.md) · [Next →](03-EVENT-DELIVERY.md)
