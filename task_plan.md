# Task Plan

## Goal
Fix the life-plan-site habit reward system so new habits do not grant coins by default, add configurable cyclic milestone rewards with currency support, clean up package retention, create a project-specific skill if useful, validate, and produce a lean runtime zip.

## Phases

1. Status: in_progress - Inspect existing habit reward data flow, packaging scripts, and project structure.
2. Status: pending - Create or update project-specific Codex skill for packaging and workflow rules.
3. Status: pending - Implement habit defaults, currencies, rewards, and milestone cycle data model/UI/logic.
4. Status: pending - Add/adjust packaging cleanup so only lean current runtime zips remain.
5. Status: pending - Validate with syntax checks and browser/logic tests.
6. Status: pending - Create final lean runtime package and append memory.

## Decisions

- Preserve append-only memory rules.
- Use multi-agent/subagent work for independent investigation or validation when available.
- Do not keep many stale zip artifacts in project root; package should contain only runtime files.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `skill-creator` read from non-system path failed | Tried `D:/codex-home/skills/skill-creator/SKILL.md` | Re-read from `D:/codex-home/skills/.system/skill-creator/SKILL.md` |
