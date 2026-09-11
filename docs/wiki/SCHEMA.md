# Wiki schema for meshlytics-prism-web-mixpanel-js-fork

This file is the contract for `docs/wiki/`. The single skill `m-wiki:wiki-init` reads this on entry. Do not edit `index.md`, `log.md`, or `SCHEMA.md` directly — the PreToolUse hook will block.

`raw/` is the team's input layer — humans drop sources there freely; **the hook does NOT block writes to `raw/`**. Run `wiki-init` whenever the team adds files to `raw/` or after meaningful code changes.

## Code precedence

For any wiki claim with a `path:Symbol` or `path:LINE` citation, the code at HEAD is authoritative. If code disagrees, the claim is wrong. `wiki-init` (update mode) auto-updates without human gate. Source-vs-source contradictions get a `> ⚠ contradicts: …` callout in the body.

## Boundary with meesho-init

`docs/architecture.md` and `CLAUDE.md` are owned by `meesho-init` — the canonical narrative documentation. **The wiki does not duplicate them.** The wiki's value is:

- Atomic concept pages — cross-cutting patterns referenced from many top-level docs
- Synthesized knowledge from sources dropped in `raw/`
- Compounding knowledge that grows over time as `raw/` accumulates

To promote a wiki rule into CLAUDE.md, re-run `/meesho-init`.

## Page types

| Type | Path | Constraints |
|---|---|---|
| `top-level` | `pages/NN-NAME.md` | Narrative — focus on slices NOT covered by `docs/architecture.md` |
| `concept` | `pages/<topic>/<slug>.md` | Atomic — soft target ≤600 words; lint warns at >1500 |

`raw/<topic>/<file>.md` is immutable team-curated storage. Humans drop files there; `wiki-init` reads them.

## Hierarchy

`max-hierarchy-depth: 1`. Single root `index.md` (no per-topic index files in v1).

## Topics declared at init

- `batching` — RequestBatcher, RequestQueue, SharedLock
- `delivery-hooks` — Meesho delivery metrics reporter hook
- `gdpr` — GDPR opt-in/out enforcement
- `release` — Build artifacts and Ringmaster publish pipeline

New topics are created by `wiki-init` (update mode) when a `raw/` file fits no existing topic.

## Page metadata

Every `top-level` and `concept` page begins with:

```
<!-- m-wiki: type=<type> slug=<slug> topic=<topic-or-null> base-sha=<12-char> generated-at=<ISO> sources=[...] -->

> Generated <date> at base-sha <12-char>. Type: <type>. <N> sources.
```

`sources=[...]` lists `raw/<topic>/<file>.md` paths the page draws from. `wiki-init` validates each path exists.

## Naming

- Top-level: `pages/NN-NAME.md` — `NN` two-digit zero-padded; `NAME` `KEBAB-UPPERCASE`.
- Concept: `pages/<topic>/<slug>.md` — `topic` and `slug` `kebab-lowercase`.
- Raw: `raw/<topic>/<filename>.md` — convention: `<YYYY-MM-DD>-<slug>.md` so chronology is sortable; not enforced.

## Link format

- Internal: `[<title>](<relative-path>)`. Markdown only — Obsidian wikilinks `[[...]]` are not used.
- Code (preferred): `path/to/file.go:FunctionName` — function names are stable across formatters/refactors. Lint greps for `^(func|type|class|interface|enum|def) FunctionName` at HEAD.
- Code (fallback): `path/to/file.go:LINE` or `path/to/file.go:LINE-LINE` for spans without a single function anchor.

## Update-mode decision tree

When `wiki-init` runs in update mode and finds an uncited file in `raw/`:

1. **Run code-truth on candidate pages first** so decisions are made against fresh state.
2. **Source extends an existing concept** → append the raw path to the existing page's `## Sources` and provenance `sources=[]`. Create a NEW concept page for genuinely new material that builds on the original (open with "Builds on [<existing-slug>](...)"). Do not bloat the existing page.
3. **Source contradicts an existing claim, code-arbitrated** → code precedence. Add a `> ⚠ note: <raw-path> disagrees with claim at <file:Symbol>` callout. Do not modify the claim.
4. **Source contradicts, non-code-arbitrated** → add `> ⚠ contradicts: …` callout. Human resolves later.
5. **Novel cross-cutting idea** → new concept page under appropriate topic (or new topic dir).
6. **Doesn't fit anywhere** → ask the user where to place it. No silent stubs.

## qmd integration

Registered as qmd collection: **`meshlytics-prism-web-mixpanel-js-fork-wiki`**. Scope is `docs/wiki/` — the synthesized answer surface. `raw/` (at repo root, team-curated input) is **not** indexed; concept pages cite the raw paths and agents read raws via those citations.

- Bootstrap: `wiki-init` runs `qmd collection add docs/wiki/ --name meshlytics-prism-web-mixpanel-js-fork-wiki` after writing files.
- Update: `wiki-init` runs `qmd update meshlytics-prism-web-mixpanel-js-fork-wiki` after each sync.
- The PostToolUse hook fires `qmd update` whenever `Edit`/`Write` modifies `docs/wiki/pages/**`.
- Retrieval: agents query via the qmd MCP server (`qmd query "<question>" --collection meshlytics-prism-web-mixpanel-js-fork-wiki`). No dedicated wiki-query skill — qmd's MCP gives every agent direct access.

## Machine-managed artifacts (v0.6+)

Two hidden artifacts live alongside the page tree under `docs/wiki/`. Both are committed to git so they're auditable in code review; neither is human-edited.

| Artifact | Owner | Lifecycle |
|---|---|---|
| `docs/wiki/.citation-index.json` | wiki-init Phase 2 | Reverse index of every `path:Symbol` citation in the wiki → which page(s) cite it. Bootstrap builds it from scratch (step 9.5); update mode incrementally rewrites entries for regenerated pages only (step 2.7). Schema versioned (`v0.6.0`). Consumed by the pre-commit shim (below) to detect drift. |
| `docs/wiki/.drift-queue/<ISO-TIMESTAMP>.yml` | pre-commit shim | One YAML file per commit that touches any source file cited by the wiki. The shim writes these; `wiki-init` update mode reads them (Phase 1 step 5.5) and drains the resolved ones after Phase 2 regeneration (step 5.5). Schema in `templates/drift-queue-entry.yml.template`. Only `affected_pages` is load-bearing; everything else is human-readable metadata. |

---

<!-- m-wiki: schema-version=2 generated-at=2026-09-11T00:00:00+00:00 base-sha=19b2bed8917f -->
