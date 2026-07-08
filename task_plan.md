# Task Plan

## Goal
Add configurable AI support to `D:\project\life-plan-site` after saving the current version, using URL + key + model settings and a small first set of AI-assisted planning actions.

## Phases

1. Status: complete - Save the current workspace version and create a working branch without reverting existing user changes.
2. Status: complete - Inspect storage, settings, UI structure, and choose minimal AI insertion points.
3. Status: complete - Implement AI configuration storage/UI and OpenAI-compatible request helper.
4. Status: complete - Add first AI-assisted actions for planning workflows.
5. Status: complete - Validate with syntax checks and targeted Playwright tests.
6. Status: complete - Package clean runtime zip and append memory.
7. Status: complete - Fix todo detail completion/subtask interaction and idea-to-todo editing/sorting issues.
8. Status: complete - Add targeted smoke coverage for todo detail completion, subtask checking, editable idea conversion, and verified idea ordering.
9. Status: complete - Validate, package, and record memory for the todo/idea fixes.
10. Status: complete - Investigate repeated auto-sync "local update uploaded" reports after refresh.
11. Status: complete - Fix unchanged-data sync detection, habit currency normalization idempotence, and sync URL joining.
12. Status: complete - Add sync regression smoke coverage and validate the full suite.
13. Status: complete - Add diary-focused AI analysis with user-confirmed write-back to review, tomorrow focus, and todos.
14. Status: complete - Fix wheel right-top management menu click behavior without restoring the deprecated bottom management panel.
15. Status: complete - Polish wheel top controls placement and reduce pre-spin summary information density.
16. Status: complete - Start P3 maintainability split by extracting sync service logic from `app.js`.
17. Status: complete - Extract local snapshot storage/version/download helpers from `app.js`.
18. Status: complete - Validate, package, commit, and push the P3 split to `master`.
19. Status: complete - Correct P3 scope to include all requested modules: sync, records, todos, ai, snapshots.
20. Status: complete - Extract records, todos, and AI business rules into service modules.
21. Status: complete - Validate, package, commit, and push the completed five-module P3 split.

## Decisions

- Preserve all existing dirty work; do not revert or overwrite unrelated changes.
- Use browser-local `localStorage` configuration for personal direct URL + key mode, with visible warnings that browser-stored keys are not safe for public deployment.
- Keep AI optional and fail closed: no AI calls unless configured by the user.
- Prefer a small, embedded assistant panel/action buttons over turning the app into a chat-first product.
- Use multi-agent work for independent read-only investigation while main implementation proceeds.
- Keep this thread scoped to AI integration and closeout only; defer non-AI UX follow-ups unless the user explicitly reopens that scope.
- A later attempt to continue non-AI work was a scope misunderstanding and was reverted back to the AI-only state.
- User explicitly reopened non-AI scope for todo detail and idea pool fixes on 2026-07-07.
- P3 means real module extraction, not only adding the shared sync foundation; keep UI refactors conservative and move pure logic first.
- P3 module split must include `sync`, `records`, `todos`, `ai`, and `snapshots`; if only part is delivered, state that clearly before calling it done.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Subagent spawn failed through local proxy on inherited `gpt-5.5` | First read-only explorer used inherited model | Restarted parallel explorers with `gpt-5.4-mini` and continued main-thread work |
