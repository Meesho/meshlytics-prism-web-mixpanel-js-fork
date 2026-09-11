<!-- m-wiki: type=concept slug=build-release-cycle topic=release base-sha=19b2bed8917f generated-at=2026-09-11T00:00:00+00:00 sources=[docs/tribal-knowledge.md] -->

> Generated 2026-09-11 at base-sha 19b2bed8917f. Type: concept. 1 source.

# Build & Release Cycle

This library ships as a committed-dist npm package. There is no build step during publish — Ringmaster reads `dist/` directly from the git commit. Missing or stale `dist/` artifacts are the most common release mistake.

## Where it applies in this repo

| Symbol | File |
|---|---|
| Build script | `build.sh` |
| Build npm script | `package.json:46` |
| Ringmaster config | `repository.yaml` |

## Why this design

Committing `dist/` makes the published artifact auditable and reproducible without a build-time dependency on the CI environment. Reviewers can diff the compiled output alongside source changes to catch unintended minification or bundling differences.

### Steps to release

1. Make changes in `src/`
2. Bump `version` in `package.json` — **required before merge**; Ringmaster keys the artifact on the version string. Merging without a bump silently republishes the previous version and can cause stale-cache issues for consumers.
3. Run `npm run build-dist` — regenerates all `dist/` artifacts
4. Commit both `src/` changes and updated `dist/`
5. Open PR → merge to `main`
6. Ringmaster's `publish_node_package` pipeline triggers automatically: publishes to `meesho-devops-admin-0622` GCP Artifact Registry and notifies `#sentry-kaizen` on failure

There is no staging publish — every merge to `main` goes straight to the registry used by production frontends.

## Related

- [Overview](../01-OVERVIEW.md)
- [Meesho Customizations](../05-MEESHO-CUSTOMIZATIONS.md)

## Sources

- `docs/tribal-knowledge.md`

## Notes

<!-- Anything below is human-owned. wiki-init never reads or modifies content under this heading. -->

---

[← Wiki index](../../index.md)

<!-- atomic: keep this page ≤600 words. New scope → new concept page that builds on this one. Do not append paragraphs here. -->
