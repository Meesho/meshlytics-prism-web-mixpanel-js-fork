# Security

## Scope

`mixpanel-browser` is Meesho's internal fork of the Mixpanel JS browser library. It runs in end-user browsers and is responsible for tracking analytics events sent to Mixpanel. It is a **published npm package**, not a deployed service — there are no servers, pods, or databases to attack directly.

Security concerns fall into two categories:

| Category | Examples |
|----------|---------|
| **Library vulnerabilities** | XSS via unsafe DOM manipulation, prototype pollution, dependency CVEs |
| **Data / privacy** | Accidental PII leakage in tracked properties, token exposure in client bundles |

## Reporting a Vulnerability

Report security issues to the Meesho Web Platform team:

- **Email**: aishvary.singh@meesho.com
- **Slack**: `#web-platform` (internal)

Do **not** open a public GitHub issue for security vulnerabilities. Include:

1. A description of the vulnerability and its impact.
2. Steps to reproduce or a proof-of-concept.
3. Affected versions (check `package.json` → `version`).

We aim to acknowledge reports within **2 business days** and resolve confirmed issues within **14 days**.

## Supported Versions

Only the latest published version on Meesho's GCP Artifact Registry receives security fixes. Pin your dependency to the latest minor release and run `npm audit` regularly.

## Security Considerations for Consumers

This library runs in the browser and collects user-interaction data. Consumers must:

- **Avoid tracking PII** (names, emails, phone numbers, addresses) as Mixpanel event properties or super-properties. Use opaque identifiers (user IDs) instead.
- **Rotate the Mixpanel project token** if it is compromised — the token is public by design (embedded in client JS) but should not be shared across environments (use separate tokens for staging vs production).
- **Review tracked properties** before shipping: call `mixpanel.get_distinct_id()` and inspect super-properties in the browser console to confirm no sensitive fields leak.

## Dependency Management

Dev dependencies (Babel, Mocha, etc.) are build-time only and not shipped to consumers. The published package's runtime surface is the compiled output under `dist/`. Run `npm audit --omit=dev` to check runtime-only exposure.

## Upstream Security Advisories

This fork tracks [mixpanel/mixpanel-js](https://github.com/mixpanel/mixpanel-js). Monitor that repo's releases and pull upstream security fixes promptly. Upstream CVEs that affect the `dist/` bundle should be treated as **high severity** and patched in the next release.
