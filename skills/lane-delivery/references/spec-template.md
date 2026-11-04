# Spec template

Copy this to `specs/<slug>.md` on the integration branch. Keep it to one or two
pages. `gate.py` parses the tables by their `##` headings and column names, so
keep both. Write paths, commands and contract names in backticks.

```markdown
# <Title>

## Why

The problem, who it affects and the intended outcome.

## What

Observable behavior, then one row per acceptance criterion.

| ID | Criterion | Method | Owner |
| --- | --- | --- | --- |
| AC-1 | One observable statement. | `exact command that exits 0 when it holds` | L1 |
| AC-2 | One observable statement. | `exact end-to-end command` | integration |
| AC-3 | One observable statement a person must judge. | `human` | integration |

## How

The approach. The shared contract (types, schema, interfaces, endpoints,
config keys, events). Alternatives rejected and why.

## Decisions

| Decision | Recommendation | Human choice |
| --- | --- | --- |
| What the human must decide. | The master's recommendation and reason. | |

## Lane graph

(Mermaid diagram of lanes and depends_on edges.)

| Lane | Functionality | Write set | Contracts changed | Contracts used | Depends on | Criteria owned | Risky |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | What this lane delivers. | `src/export/**`, `tests/test_export.py` | `export_csv(rows, path)` | none | none | `AC-1` | no |
| L2 | What this lane delivers. | `src/cli/**`, `tests/test_cli.py` | none | `export_csv(rows, path)` | L1 | `AC-4` | yes |

## Concurrency risks

One row per pair of concurrent lanes with detected coupling.

| Lanes | Coupling evidence | Decision | Recovery |
| --- | --- | --- | --- |
| L3, L4 | Both add a migration under `db/migrations/`. | accept | Lane merged second renumbers its migration, reruns G1 and G2. About ten minutes. |
| L5, L6 | L5 changes `parse()` and L6 adds a caller. | edge: L6 depends on L5 | none |

## Out of scope

What will not change.

## Changelog

Graph amendments after approval, each with date and reason.
```

## Rules the gate enforces

- Criterion IDs are `AC-<n>` and unique. Method is one backticked command or
  `human`. Owner is a lane id or `integration`.
- Every lane owns at least one criterion, and its Criteria owned cell lists
  exactly the criteria whose Owner is that lane.
- Every `Depends on` target exists and the graph has no cycle.
- Each pair of concurrent lanes (no dependency path between them) that shares a
  declared contract, has overlapping write sets, writes the same lockfile or
  migrations directory, or is passed with `--flag A,B` needs a Concurrency risks
  row. `edge` rows need the dependency in the graph. `accept` rows need a
  recovery.
