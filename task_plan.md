# Task Plan

## Goal
Add configurable AI support to `D:\project\life-plan-site` after saving the current version, using URL + key + model settings and a small first set of AI-assisted planning actions.

## Current Goal (2026-07-23)
Continue the habit migration by turning the diagnostic sync skeleton into a strictly read-only remote pull and merge preview for `/apps/habit-app/data.json`, without changing `lifePlanData`, `localStorage.habitAppData`, or issuing PUT requests.

## Current Goal (2026-07-23, protected upload)
Create the first remote habit snapshot safely: add a session-only upload arm, rebuild and validate the legacy-authoritative local mirror, re-GET the remote path immediately before upload, require explicit confirmation, then PUT only the verified local snapshot when the remote file is still absent.

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
22. Status: complete - Add local save failure recovery UI and unified localStorage write failure handling.
23. Status: complete - Make snapshot write failures explicit instead of reporting fake success.
24. Status: complete - Add 20-second sync request timeouts and queued follow-up sync for edits during active sync.
25. Status: complete - Validate the data safety/sync reliability batch and package runtime files.
26. Status: complete - Commit and push the data safety/sync reliability batch to `master`.
27. Status: complete - Remove unused sync credentials, harden import/restore confirmations, validate, package, and commit the follow-up data safety batch.
28. Status: complete - Inspect the current habit diagnostics, sync-service helpers, UI conventions, and existing smoke coverage.
29. Status: complete - Implement read-only remote habit pull and local/remote/merged preview state with explicit risk reporting.
30. Status: complete - Render the preview in the diagnostics UI while preserving existing product styles and disabled upload safeguards.
31. Status: complete - Add targeted smoke coverage proving GET-only behavior and zero local data mutation.
32. Status: complete - Run syntax/targeted/full validation, package a clean runtime zip, and append conversation memory.
33. Status: complete - Inspect the existing push/ETag APIs and define the protected first-upload state machine and failure rules.
34. Status: complete - Implement session-only arming, preflight rebuild/consistency checks, final remote recheck, and guarded first PUT.
35. Status: complete - Add clear inline UI states for arm, confirmation, success, remote-race refusal, and errors.
36. Status: complete - Add Playwright coverage proving unarmed uploads cannot PUT and an armed confirmed first upload performs exactly GET then PUT.
37. Status: complete - Run targeted/full validation, visually inspect, package, commit, push, and append memory.
38. Status: complete - Correct the diagnostics consistency count so only canonicalizable habit tombstones are compared with the habit mirror.
39. Status: complete - Add regression coverage for mixed habit and non-habit legacy tombstones and rerun targeted/full checks.
40. Status: complete - Package the corrected runtime, commit, push, and append memory.

41. Status: complete - Add protected cloud-sync flow for the existing habit file with baseline checks and conditional writes.
42. Status: complete - Validate the new habit cloud-sync flow, package a clean runtime zip, and commit/push the result.
43. Status: complete - Add protected manual cloud-to-PC habit merge apply flow without changing sync endpoint or Worker.
44. Status: complete - Validate the cloud-to-PC apply flow, package a clean runtime zip, then commit and push.
45. Status: in_progress - Add post-apply habit sync guidance so the diagnostics UI clearly tells the user whether the next step is cloud sync or no action.
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
- Data safety work should clearly distinguish completed reliability fixes from larger storage roadmap items like IndexedDB migration, data-volume dashboards, and ETag conflict prevention.
- Sync settings should only expose fields that are actually used by the Cloudflare Worker sync path; unused WebDAV username/password fields should be removed and cleaned from old local config.
- Wheel JSON restore remains an explicit overwrite action for now, but it must confirm the overwrite, create a restore-before snapshot, and leave current data untouched when canceled or when saving fails.
- Habit remote preview remains strictly read-only: it may GET `/apps/habit-app/data.json`, but must not mutate legacy habit fields, `localStorage.habitAppData`, or remote data; `autoSync` and `remoteUploadEnabled` remain `false`.
- The protected first-upload phase supersedes the permanent-false part only during an explicitly armed browser session: `remoteUploadEnabled` starts false, is never restored from storage, and automatically returns false after any upload attempt. No automatic upload or authority switch is introduced.
- Habit bootstrap must reuse the already configured unified sync endpoint. The user should not have to enter or migrate a second habit-specific URL; only `/apps/habit-app/data.json` remains habit-specific.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Subagent spawn failed through local proxy on inherited `gpt-5.5` | First read-only explorer used inherited model | Restarted parallel explorers with `gpt-5.4-mini` and continued main-thread work |
| GitHub HTTPS push failed from direct network | `git push origin master` failed with `Connection was reset` / `Couldn't connect to server`; `Test-NetConnection github.com -Port 443` also failed, while `ssh.github.com:443` was reachable but local SSH auth lacked a GitHub key | Detected local proxy service on `127.0.0.1:7897` and pushed with temporary per-command Git proxy: `git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin master`; do not change global Git config |
| First final full site check reported 3 merge regressions | Latest `app-sync-kit` life-plan adapter used remote-wins `>=` ties, unlike the site's local-safe `>` fallback, so unstamped old backups could overwrite local items | Changed adapter ties to preserve local data, added life-plan adapter regression checks, rebuilt/copied the browser bundle, passed the 3 focused tests, then passed all 63 site tests |
