# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context repo.

Before exploring, read:

- `CONTEXT.md` at the repo root
- Relevant ADRs under `docs/adr/`

If any of these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. Producer skills such as `/grill-with-docs` create them lazily when terms or decisions actually get resolved.

## Current Files

- Root context: `CONTEXT.md`
- Root ADR directory: `docs/adr/`

## Use the glossary's vocabulary

When your output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, either reconsider whether the project uses that language or note the gap for `/grill-with-docs`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> Contradicts ADR-0007 (event-sourced orders), but worth reopening because...
