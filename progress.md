# Progress

## 2026-07-27 - Vue migration continuation

- Restored the project, planning, and memory workflows and inspected the current branch, worktree, recent migration commits, protected branches, and stash.
- Confirmed `migration/vue-app-v1` is clean at `cc18d62` and matches its remote tracking branch; no protected state was modified.
- Read the Vue parity and deployment/rollback documents. Selected Todo detail/subtask/session/relationship parity as the next bounded candidate pending source-level contract audit.
- Replaced the stale active goal in `task_plan.md` with the formal Vue replacement-candidate objective and added phases 46-52 for the current migration stream.
- A large parallel source-reading wrapper failed before returning nested command output; logged it and split the read-only audit into smaller batches.
- Implemented Todo detail editing, subtask completion sync, one-per-day execution sessions, record/idea relationship visibility, and reference-cleaning deletion through the Vue store/repository boundary.
- Added a full lifecycle Playwright contract covering persisted Todo fields, subtask-driven completion, sessions, `todoAppData`, tombstones, and record/idea reference cleanup; the focused test and full Vue suite passed.
- Verified protected `master` in an isolated `.tmp` export because current-branch legacy tests load the Vue entry: all script syntax checks and all 73 master Playwright tests passed.
- Visually inspected desktop and mobile Todo detail layouts, then corrected the Vue-specific filter grid and detail delete-button styling found by the screenshots.
- Final standard `scripts/check.ps1` passed all 7 Vue migration tests; `npm run build` completed with 80 transformed modules, and `git diff --check` passed.
- Updated `docs/vue-migration-parity-checklist.md` with the verified Todo detail contract slice and explicit remaining Todo blockers; this stage does not claim complete Todo parity.
- Completed migration phases 50-52 and prepared the verified Todo detail parity stage for a local commit on `migration/vue-app-v1`.
- Committed the verified Todo detail parity stage as `30d274e`.
- Started phases 53-55 to close legacy Todo filter parity and linked-record deep navigation while keeping all filter/navigation operations read-only.
- Added start/end date, status, urgency, group, exclusive/shared, and text filters; the date range delegates to the legacy Todo service and the table now exposes exclusive/shared state.
- Added `record=<id>` deep links between Todo relationships and the Records editor, including direct-load restoration and query cleanup when closing.
- Added a read-only regression proving all filters and the deep link work while the exact `lifePlanData` string remains unchanged and no Todo mirror is generated.
- Focused filtering/navigation coverage passed, the full Vue suite passed 8/8, and desktop/mobile screenshot checks confirmed visible date labels and zero page-level horizontal overflow.
- Final `scripts/check.ps1`, `npm run build`, and `git diff --check` passed for phases 53-55; prepared the verified filter/deep-link stage for a local commit.
- Committed the verified Todo filter and linked-record deep-navigation stage as `db9dcd9`.
- Started phases 56-58 after confirming the legacy calendar emits a Todo plan item for every day in the plan range, a due item on the deadline, and execution items for sessions; all three open Todo detail.


## 2026-07-23

- Investigated the user's real diagnostics screenshot and identified the upload blocker as a tombstone comparison-scope bug, not a Sync URL, Worker, or actual mirror-data mismatch.
- Extracted one shared legacy-to-canonical tombstone mapper and reused it for both snapshot construction and consistency counting, so the two sides now compare the same habit-only domain.
- Added a regression with two unrelated tombstones plus one habit tombstone; the mirror keeps only the habit tombstone and consistency reports `1 / 1 matched`. The focused diagnostics test passed.
- Ran the full `scripts/check.ps1` validation after the Tombstone scope correction; all 63 Playwright smoke tests passed.
- Generated the corrected clean runtime package at `D:\project\life-plan-site\life-plan-site-runtime-20260723-113642.zip`; five-package retention removed `life-plan-site-runtime-20260722-112039.zip`.

- Started the protected first-upload phase after the user clarified the final PC + mobile shared-authority goal and delegated next-step judgment.
- Chose a session-only, explicit-confirmation remote bootstrap; development tests will intercept fake endpoints and will not touch the user's real cloud file.
- Confirmed the sync service supports create-only conditional PUT with `If-None-Match: *`; started mapping the guarded state machine and test interception requirements.
- Recorded the user's clarification that no manual habit sync configuration was performed or should be required; the existing unified endpoint remains the sole URL source.
- Read the uploaded screenshot and confirmed the real shared endpoint currently returns 404 at the habit path.
- Integrated the read-only protocol review: current Worker KV cannot guarantee atomic create-only behavior, provider mode ignores conditional options, and legacy tombstone normalization can target the wrong ID.
- Decided to add canonical tombstones, stricter local-data gates, a final GET, one conditional PUT, and a post-upload GET/hash verification; the UI will describe this as guarded verification rather than absolute atomic protection.
- Completed the protected first-upload implementation and canonical habit-schema conversion, including adapter-domain hashing in `app-sync-kit`.
- Re-ran the targeted habit suite after correcting the hash-domain assertion; all 9 selected tests passed.
- Added and passed a tenth regression proving lossy legacy rules such as `monthly-count` disable session authorization and issue zero PUT requests.
- Visually inspected the default read-only, session-armed, and successful verified-upload states at desktop width; the existing UI hierarchy and safety caveats remain readable.
- Ran `app-sync-kit` full verification successfully, including typecheck, build, browser/WebDAV/life-plan/wheel/habit behavior suites.
- The first final site check exposed three pre-existing adapter tie regressions after refreshing the vendor bundle; fixed the source adapter so equal or missing timestamps preserve local data, with remote diary text kept as a conflict copy.
- Rebuilt and copied the browser bundle, confirmed matching SHA-256 hashes, passed the three focused merge tests, and then passed all 63 Playwright smoke tests through `scripts/check.ps1`.
- Generated the clean runtime package `D:\project\life-plan-site\life-plan-site-runtime-20260723-112056.zip`; the five-package retention policy removed `life-plan-site-runtime-20260722-105654.zip`.
- Committed the `app-sync-kit` adapter/hash fixes as `9152121 Harden adapter sync decisions` and pushed `main` (including the two previously local habit/wheel commits) to `origin/main`.

- Read the habit migration handoff and confirmed the current task is a read-only remote pull/merge preview.
- Loaded the project workflow, persistent planning, product UI, and memory append instructions.
- Checked the worktree; only the pre-existing untracked `.zcode/` directory is present.
- Added phases 28–32 for inspection, implementation, UI, tests, validation, packaging, and memory.
- Located the sync state/config helpers, diagnostic renderer, `sync-service.js` hash/merge/pull APIs, and existing habit Playwright coverage.
- Defined the in-memory-only preview state and risk model; no preview action will persist sync state or local/merged snapshots.
- Implemented GET-only remote pull, raw schema validation, local/remote/merged hash and collection summaries, and merge risk detection in `app.js`.
- Added a responsive inline preview table and status/risk states in `styles.css`, following the existing diagnostics UI rather than introducing a modal.
- Added Playwright coverage for successful GET-only merge preview, missing remote files, schema gaps, disabled upload safeguards, and unchanged local storage.
- Syntax checks and `git diff --check` passed.
- Targeted habit validation passed 5/5 tests.
- Visually inspected the diagnostics idle and successful preview states at desktop width; the comparison table and status/risk hierarchy are readable and remain within the existing UI language.
- Full `scripts/check.ps1` validation passed all 58 Playwright smoke tests.
- A read-only review agent found no reachable PUT path and identified two preview-accuracy refinements; added all 13 habit collections to schema checks, clarified the bootstrap-versus-GET persistence copy, and extended malformed JSON coverage.
- Re-ran targeted habit checks (5/5) and the full `scripts/check.ps1` suite (58/58) after the review fixes.
- Generated the final clean runtime package at `D:\project\life-plan-site\life-plan-site-runtime-20260723-103435.zip`; the latest packaging run removed the older `life-plan-site-runtime-20260720-154129.zip` artifact under the five-package retention policy.

## 2026-07-14

- Continued the data safety follow-up on a clean `master` worktree after the interrupted subagent attempt; true sidecar spawning was not used because the spawn calls failed parameter validation, so local parallel file reads were used instead.
- Removed unused cloud sync `username` and `password` fields from default sync config, the sync settings form, form apply/read logic, and persisted config saves.
- Added cleanup for old `lifePlanSyncConfig` values so legacy `username/password` are deleted when sync config is loaded or saved.
- Tightened main data import by asking for explicit confirmation if the pre-import safety snapshot cannot be created.
- Hardened wheel full JSON restore with an overwrite confirmation, restore-before local snapshot, cancellation path that leaves current wheel data untouched, and save-failure rollback to the previous wheel data.
- Added Playwright smoke coverage for legacy sync credential cleanup, wheel restore overwrite confirmation plus snapshot creation, and cancel-before-overwrite behavior.
- Ran syntax checks for `app.js`, `wheel-tool.js`, and `tests/smoke.spec.js`; all passed.
- Ran targeted Playwright coverage with `npx playwright test tests/smoke.spec.js --grep "legacy sync credentials|wheel backup restore"`; 3 tests passed.
- Ran full `./scripts/check.ps1`; all 33 Playwright smoke tests passed.
- Ran `./scripts/package-clean.ps1` and produced `D:\project\life-plan-site\life-plan-site-runtime-20260714-150356.zip`.

## 2026-07-13

- Rechecked the current `master` worktree and confirmed the active fix set was about local save failure recovery, snapshot write failure handling, sync timeout, and queued follow-up uploads.
- Added a persistent local-save warning block in the sidebar with `立即导出`, `管理快照`, and `重试保存` actions, and made the warning auto-open the backup panel.
- Routed main data, sync state, sync config, wheel sync config, and AI config writes through a shared safe localStorage wrapper so failures now surface consistently.
- Changed snapshot creation to return `null` on write failure and show a failure status instead of pretending the snapshot succeeded.
- Added 20-second abort-based timeout handling to both the project sync service and the vendored AppSyncKit WebDAV request path.
- Added pending sync follow-up behavior for both main cloud sync and wheel cloud sync so edits made during an active sync are not dropped.
- Added Playwright smoke coverage for local save recovery, snapshot write rejection, sync timeout messaging, and queued follow-up uploads.
- Ran syntax checks for `app.js`, `sync-service.js`, `snapshot-service.js`, `vendor/app-sync-kit.browser.global.js`, and `tests/smoke.spec.js`.
- Ran targeted Playwright smoke tests for the new failure/timeout/queue cases; all 6 passed.
- Ran full `.\scripts\check.ps1`; all 28 Playwright smoke tests passed.
- Ran `git diff --check`; no whitespace errors were reported.
- Ran `.\scripts\package-clean.ps1` and produced `D:\project\life-plan-site\life-plan-site-runtime-20260713-163719.zip`.
- Updated `docs/project-issue-tracker.md` to mark the completed items and keep the remaining data-volume and sync-diagnostics work visible.
- Committed and pushed the data safety/sync reliability batch to online `master`.

## 2026-07-07

- Created Codex goal for adding configurable AI support to the life planning app.
- Re-read `life-plan-site-dev` and `planning-with-files` instructions.
- Read existing planning files and ran `session-catchup.py`; no extra catchup output.
- Saved current workspace version to `D:\project\life-plan-site-version-backups\life-plan-site-pre-ai-20260707-142843.zip`.
- Switched to new branch `codex/ai-integration`.
- Replaced stale habit-reward task plan with AI integration phases.
- Spawned two read-only explorers for storage/settings analysis and UI insertion-point analysis after the first explorer failed.
- Reviewed `git status`, planning files, and AI diffs to confirm the implementation already landed in `index.html`, `app.js`, `styles.css`, and `tests/smoke.spec.js` without reopening paused non-AI scope.
- Re-read `codex-memory-architecture` before final closeout work.
- Verified AI syntax with `node --check .\app.js`.
- Ran `npx playwright test tests/smoke.spec.js --grep "AI"`; 5 tests passed, covering AI config isolation, OpenAI-compatible Base URL requests, local AI today-plan creation, and AI todo breakdown flow.
- Ran `.\scripts\package-clean.ps1` and produced `D:\project\life-plan-site\life-plan-site-runtime-20260707-154052.zip`.
- Corrected a scope misunderstanding after the AI closeout: reverted the temporary non-AI idea-to-todo editable draft code and test changes, keeping the thread AI-only.
- User explicitly reopened non-AI scope for todo and idea module fixes.
- Implemented todo detail main-task completion toggle in the view actions, with button text switching between `标记完成` and `恢复未完成`.
- Reworked idea-to-todo conversion to open an editable todo draft first; saving creates and links the todo, while canceling does not create anything.
- Shortened default idea-derived todo titles so long idea content is kept in notes instead of being forced into the title.
- Adjusted default idea pool ordering so `已验证` ideas are listed after active ideas unless explicitly filtered.
- Added smoke coverage for editable idea conversion, todo detail completion/subtask checking, and verified-idea ordering.
- Verified with `node --check .\app.js`, targeted Playwright checks, and full `.\scripts\check.ps1`; full smoke suite passed with 16 tests.
- Ran `.\scripts\package-clean.ps1` and produced `D:\project\life-plan-site\life-plan-site-runtime-20260707-164418.zip`.
- Spawned read-only subagent `Boyle` for todo/idea fix review; it found no blocking functional issue and recommended extra smoke coverage for canceling idea drafts and explicit status filters.
- Added those extra smoke assertions, reran targeted checks and full `.\scripts\check.ps1`; full smoke suite still passed with 16 tests.
- Regenerated final runtime package at `D:\project\life-plan-site\life-plan-site-runtime-20260707-165355.zip`.
- Investigated the refresh-time sync false positive where the UI repeatedly showed `发现本地更新，已上传` despite no user edits.
- Fixed habit currency normalization to preserve existing timestamps, made render-only currency name lookup avoid mutating `data`, adjusted main and wheel auto-sync to treat missing `lastRemoteHash` plus matching remote hash as already consistent, and hardened WebDAV URL joining for base URLs without a trailing slash.
- Added two Playwright smoke tests for unchanged auto-sync reload behavior and first-seen identical remote data; targeted sync tests passed.
- Ran `node --check .\app.js` and full `.\scripts\check.ps1`; full smoke suite passed with 18 tests.
- Ran `.\scripts\package-clean.ps1` and produced `D:\project\life-plan-site\life-plan-site-runtime-20260707-172407.zip`.
- Implemented diary-focused AI analysis as a new `日记分析` assistant mode, including diary context selection, local fallback analysis, AI JSON normalization for diary fields, and user-confirmed write-back to `复盘` / `明日重点` / other diary sections.
- Added diary AI actions to create suggested todos only after confirmation and link them back to the source diary.
- Added smoke coverage proving diary AI suggestions do not mutate the diary before confirmation, then write review/tomorrow sections and create linked diary todos after explicit clicks.
- Verified diary AI with `node --check .\app.js`, `node --check .\wheel-tool.js`, `node --check .\tests\smoke.spec.js`, and `npx playwright test tests/smoke.spec.js --grep "AI"`; AI targeted tests passed with 6 tests.
- Ran full `.\scripts\check.ps1`; 16 tests passed and 3 existing wheel management-menu tests timed out at `#wheel-action-menu`, so wheel management is tracked as the next separate phase rather than mixed into the diary AI commit.
- Fixed the wheel right-top `管理` menu by restoring menu open/close handlers, routing menu items into the existing management modals, rendering modal bodies, adding the public-library batch/tag tools inside the modal, and raising the mode bar stacking layer so the stage card no longer intercepts menu clicks.
- Verified the wheel fix with `npx playwright test tests/smoke.spec.js --grep "wheel"`; all 6 wheel tests passed.
- Ran full `.\scripts\check.ps1` after the wheel fix; all 19 smoke tests passed.
- Ran `.\scripts\package-clean.ps1` and produced `D:\project\life-plan-site\life-plan-site-runtime-20260707-192646.zip`.
- Uploaded the diary AI and wheel management fixes to online `master` via GitHub API after normal `git push origin master` failed to connect to GitHub 443; verified remote `master` at `bf2b9496beccfb10829fec55da95738d244fcab5` with matching blobs for the six changed runtime/test files.
- Polished the wheel page after screenshot feedback: kept the right-top `管理` control in the same top row on desktop/tablet widths, reduced pre-spin stage summary copy/stats, and compacted the empty result placeholder.
- Re-verified with `node --check .\wheel-tool.js`, `npx playwright test tests/smoke.spec.js --grep "wheel"` (6/6), and full `.\scripts\check.ps1` (19/19).

## 2026-07-08

- Reconfirmed that P3 means actual code extraction, not just using `app-sync-kit`.
- Added `sync-service.js` and moved sync hashing, WebDAV/AppSyncKit remote I/O, deletion tombstones, main-data merge, record conflict-copy merge, and wheel snapshot merge logic behind `window.LifePlanSyncService`.
- Added `snapshot-service.js` and moved local snapshot cloning, normalization, versioning, parent tracking, storage stats, timestamped file naming, and JSON download helpers behind `window.LifePlanSnapshotService`.
- Kept `app.js` responsible for UI state, render calls, sync status messages, and existing public function names so inline handlers and smoke tests continue working.
- Loaded the new services from `index.html` before `app.js` and added them to `scripts/package-clean.ps1`.
- Verified syntax with `node --check .\app.js`, `node --check .\sync-service.js`, and `node --check .\snapshot-service.js`.
- Ran targeted sync/merge smoke coverage with `npx playwright test tests/smoke.spec.js -g "auto sync|record merge|tombstoned|wheel snapshot|snapshot"`; 6 tests passed.
- Ran full `.\scripts\check.ps1`; 24 smoke tests passed.
- Regenerated clean runtime package at `D:\project\life-plan-site\life-plan-site-runtime-20260708-151559.zip`.
- User corrected that P3 was supposed to split all five modules, not only `sync` and `snapshots`; accepted that the previous delivery was incomplete.
- Added `records-service.js` for idea status/tag helpers, idea-to-todo default text/note, record content section parsing, suggested record date ranges, and idea filtering/sorting.
- Added `todos-service.js` for urgency metadata helpers, todo focus sorting, date range matching, session-on-date checks, done toggling, subtask completion sync, date-range normalization, and AI todo construction.
- Added `ai-service.js` for AI config normalization, OpenAI-compatible Chat Completions URL construction, remote AI requests, JSON result parsing/normalization, capture text cleanup, and local AI fallback generation.
- Updated `app.js` to keep UI rendering and existing public function names while delegating records/todos/AI logic to the new services.
- Loaded `records-service.js`, `todos-service.js`, and `ai-service.js` from `index.html` before `app.js`, and added them to `scripts/package-clean.ps1`.
- Verified syntax with `node --check` for `app.js`, `records-service.js`, `todos-service.js`, and `ai-service.js`.
- Ran targeted smoke coverage with `npx playwright test tests/smoke.spec.js -g "AI|todo detail|idea can be converted|verified ideas|global search|loads the app"`; 11 tests passed.
- Ran full `.\scripts\check.ps1`; 24 smoke tests passed.
- Regenerated clean runtime package at `D:\project\life-plan-site\life-plan-site-runtime-20260708-154544.zip`.

## 2026-07-06

- Started multi-agent-enabled work for habit reward changes and package retention.
- Read `planning-with-files` instructions.
- Read `skill-creator` instructions after correcting the system skill path.
- Created planning files in project root.
- User interrupted implementation and asked to pause habit coding for a方案 first.
- One partial code edit exists in `app.js`: constants for habit default currency and milestone days were added, but no functional habit logic was implemented yet.
- Packaging explorer reported `scripts/package-clean.ps1` currently keeps 5 `life-plan-site-clean-*.zip` packages and should be changed later to produce lean `life-plan-site-runtime-*.zip` with only `index.html`, `app.js`, `styles.css`, `wheel-tool.js`, `wheel-tool.css`, default keep count 1.

- Implemented habit module files, multi-currency wallet UI, milestone config fields, unified sync endpoint UI, and runtime package whitelist script. Validation started.

- Targeted Playwright verification first failed because temp script ran outside project module resolution and could not find @playwright/test; retrying from project context.

- Added the guarded PC -> cloud habit sync flow for the already-created remote file: the diagnostics page now distinguishes first creation from later cloud sync, and later sync uses a last-known-baseline check plus If-Match rather than opening automatic upload.
- Added Playwright coverage for unchanged-baseline cloud sync and cloud-race blocking, including the ETag exposure path needed for cross-origin verification.
- Re-ran targeted habit smoke coverage and kept the first-upload and read-only preview regressions green.
- Full scripts/check.ps1 passed all 65 Playwright smoke tests after adding the protected PC -> cloud habit sync path.
- Generated a fresh clean runtime package at D:\project\life-plan-site\life-plan-site-runtime-20260723-121840.zip; the cleaner removed life-plan-site-runtime-20260723-102647.zip.
- Started the protected cloud-to-PC habit apply phase without changing `D:\project\app-sync-kit`, the online Worker, or the single unified sync endpoint.
- Added a manual diagnostics action that re-GETs `/apps/habit-app/data.json`, refuses stale previews, merges with the current local mirror, asks for confirmation, creates a local snapshot, writes the merged habit slice back into PC legacy fields, then rebuilds `localStorage.habitAppData`.
- Added reverse canonical-to-legacy mapping for habits, habitRecords, habitLedger, habitRewards, currencies, and habit tombstones; external canonical IDs are preserved in legacy rows through `remoteId` so future mirror rebuilds keep stable cross-device identity.
- Added smoke coverage proving a cloud/mobile habit/checkin/ledger can be applied to PC with zero PUT requests, and proving the apply action stops if the cloud file changes after preview.
- Targeted cloud-to-PC apply tests passed, and the broader habit diagnostics/protected sync regression group passed 12/12.
- An overlapping full `scripts/check.ps1` run still used the earlier too-strict post-apply hash gate and failed 1/67; after removing that gate, the targeted cloud-to-PC apply tests passed again. A fresh full check is required before packaging.
- Added post-apply diagnostics guidance so the UI now tells the user whether the next step after applying cloud changes to PC is a protected cloud sync or no further action; added smoke coverage for that hint.
## 2026-07-27 - Todo cross-entry parity continuation

- Completed phase 56 by wiring `todo=<id>` detail restoration and cleanup, Dashboard Todo links, record-calendar selection, plan/due/session schedule items, and legacy date presets.
- `npm run build` passed after the calendar selection integration.
- Added and passed the focused Playwright test `todo dashboard route presets and calendar entries preserve one read-only detail target` (1/1).
- Phase 57 is in progress: full Vue checks and responsive visual verification remain.
- Full `scripts/check.ps1` passed all syntax checks and 9/9 Vue Playwright tests.
- Desktop 1440px and mobile 390px Todo edit/detail and day-calendar screenshots showed the date presets and all three schedule item types without overlap; all four page checks reported `scrollWidth === clientWidth`.
- Updated the migration parity checklist and moved phase 58 into progress for final review and commit.
- Final `npm run build` and `git diff --check` passed; protected branch and stash pointers remained unchanged before commit.
- Committed the Todo cross-entry slice as `43c36a2 feat: add todo cross-entry parity`.
- Started phase 59 for Todo-detail record relationship creation/removal; selected record ownership and exclusive-source invariants before editing.
- Added store-backed Todo-side record link/unlink controls; `npm run build` passed after implementation.
- Added the relationship persistence/exclusive-source Playwright contract. Its corrected focused run passed 1/1 after replacing a whole-panel text assertion with a linked-row command assertion.
- Full `scripts/check.ps1` passed syntax checks and 10/10 Vue Playwright tests.
- Relationship controls passed desktop 1440px and mobile 390px visual review. The desktop `.vue-main` scroll container exposed the full sticky panel (`scrollHeight 1540`, `clientHeight 1000`) with no horizontal overflow; the mobile full page also had `scrollWidth === clientWidth`.
- Updated Todo parity evidence; final `npm run build` and `git diff --check` passed before the phase 61 commit.
- Committed Todo relationship editing as `fcfcf72 feat: edit todo record relationships`.
- Audited the legacy Todo independent sync state machine and opened phases 62-66 for a faithful Vue port using existing canonical/merge services.
- Implemented the Vue Todo sync panel with fixed-path preview, merge apply, `If-Match` existing upload, session-armed `If-None-Match` first creation, and post-PUT verification; production build passed.
- Added three focused network/persistence contracts; preview/apply, existing upload, and first creation passed 3/3 on their first run.
- Added a preview-to-upload remote race regression proving the flow stops after two GETs, sends no PUT, and records `lastConflictAt`; all four focused Todo sync contracts passed 4/4.
- Full `scripts/check.ps1` passed 14/14 Vue Playwright tests; final production build also passed after correcting independent-apply main dirty semantics.
- Desktop 1440px and mobile 390px Todo sync previews showed all actions and comparison states without overlap; document and `.vue-main` both reported `scrollWidth === clientWidth`.
- Verified stale persisted Todo upload authorization is reset on load and remains unchecked until the current session explicitly arms first creation.
- Final review restored the legacy second confirmation when an application-before snapshot cannot be created; the focused apply contract, production build, and `git diff --check` passed afterward.
- Opened phases 67-71 for the Records template parity stage: legacy contract audit, built-in structured fields, custom template management, persistence tests, responsive verification, documentation, and commit.
- Implemented shared built-in template definitions/helpers, Vue structured fields, custom template CRUD, Todo cloning, and template tombstones; production build passed and the first focused run passed custom-template coverage while exposing only an over-scoped built-in test locator.
- Focused Records template contracts passed 2/2 after correcting test-only locator and newline expectations; coverage proves exact legacy Markdown, persisted `templateId`, removed `templateFields`, custom Todo cloning, source-record rebinding, and template deletion tombstones.
- Full `scripts/check.ps1` passed syntax checks and 16/16 Vue Playwright tests.
- Desktop 1440px template editing had no overflow. The first 390px screenshot exposed the legacy six-column Records filter grid; a Vue-scoped three-column/one-column override removed the overflow, and the final document, `.vue-main`, and editor all reported `scrollWidth === clientWidth`.
- Final production build, JavaScript syntax checks, `git diff --check`, and the full 16/16 Vue Playwright suite passed before the Records template stage commit.
- Committed the Records template stage as `f9e251f feat: add record template parity`; opened phases 72-76 for idea-specific Records editing, Ideas filters/navigation, contract tests, responsive verification, docs, and commit.
- Implemented idea-specific Records editing/preview, Ideas special-state and tag filters, Records/Todo deep navigation, and legacy-compatible conversion updates; the first focused run passed conversion and exposed only an ambiguous test locator, then both focused contracts passed 2/2.
- Full `scripts/check.ps1` passed syntax checks and 18/18 Vue Playwright tests after the idea-detail implementation.
- Ideas and Records screenshots at 1440px and 390px showed long tags, next actions, conclusions, filters, and detail controls without overlap; document, `.vue-main`, and active page all reported `scrollWidth === clientWidth`.
- Extended the focused contract to prove changing an idea record to `日记` clears all five idea-only fields; both focused contracts remained 2/2 green.
- Final production build, `git diff --check`, and the full 18/18 Vue Playwright suite passed before the idea-detail stage commit; protected branch and stash pointers remained unchanged.
- Committed the idea-detail stage as `30175c5 feat: add idea detail parity`; opened phases 77-80 for repository-backed existing-record autosave, close/switch/navigation flush, contract tests, docs, and commit.
- Implemented one-path existing-record persistence for manual save, 3-second autosave, and close/switch/navigation flush; same-record reselection preserves dirty input and active-record deletion cancels the pending write.
- Focused autosave coverage passed, then full `scripts/check.ps1` passed syntax checks and 19/19 Vue Playwright tests.
- Desktop dirty-state and mobile auto-saved-state screenshots showed clear status text with no overlap; document, `.vue-main`, and active Records page all reported `scrollWidth === clientWidth`.
- Final production build and `git diff --check` passed before the existing-record autosave stage commit; protected branch and stash pointers remained unchanged.
- Opened phases 81-85 for Records diary AI parity and completed the legacy contract audit before implementation.
- Added store-owned diary section composition and linked AI Todo creation plus a Records editor analysis workspace with remote/local generation, editable drafts, overwrite confirmation, duplicate hints, and request invalidation; production build passed after two narrow TypeScript corrections.
- The focused remote diary contract passed after fixing the Vue AI adapter's urgency/date dependencies; full `scripts/check.ps1` then passed syntax checks and 20/20 Vue Playwright tests.
- Desktop 1440px and mobile 390px diary AI drafts showed editable sections and Todo dates without overlap; document, `.vue-main`, Records, and the AI panel all reported `scrollWidth === clientWidth`.
- Updated the migration checklist and preview deployment guide to close the diary AI blocker while retaining new-record draft/filter and non-diary AI mode gaps.
- Final production build, `git diff --check`, and all 20 Vue Playwright tests passed; responsive overflow checks remained clean.
- Created clean runtime package `life-plan-site-runtime-20260727-222706.zip` and retained the newest five packages per project policy.
- Opened phases 86-90 for the Records new-record modal/draft stage and completed the legacy lifecycle audit before implementation.
- Added `RecordCreateModal.vue` with grouped legacy types, suggested ranges, diary title/default templates, structured and idea fields, meaningful-input gating, three-second first-save debounce, close/unmount flush, and scoped existing-record redirection; production build passed.
- Both focused new-record lifecycle contracts passed on their first run; coverage includes untouched initialization, delayed first persistence, immediate close flush, route-leave flush, exact built-in Markdown, idea fields, and scoped reuse.
- Full `scripts/check.ps1` passed syntax checks and 22/22 Vue Playwright tests; the production build and `git diff --check` also passed.
- Desktop 1440px and mobile 390px type-picker/editor/footer screenshots had no overlap or horizontal overflow. The first pass exposed narrow structured textareas; the corrected fields now use 828px/358px respectively while all measured containers retain `scrollWidth === clientWidth`.
- Updated parity and preview documentation to close the new-record modal/draft blocker while leaving legacy Records filters explicit.
- Opened phases 91-95 for Records filtering parity and completed the legacy contract audit. Confirmed missing day-order/idea filters/search fields, missing list operation events, and incorrect calendar inclusion of Todo plan/due items.
- Implemented fixed legacy Records type options, day ordering, idea status/tag filters, complete record keyword fields, today-bounded list ranges, and shared list/calendar event rules that include Todo sessions plus aggregated habit check-ins while excluding Todo plan/due events.
- Added a read-only Playwright contract covering filter semantics, operation-event inclusion, habit aggregation, range boundaries, and exact storage immutability; the focused test passed 1/1 on its first run.
- The first full check passed 22/23 and exposed a conflict with the previously accepted Todo plan/due calendar entry points. Scoped legacy event exclusion to the Records list and retained the Vue calendar superset before rerunning checks.
- The corrected focused cross-entry/filter run passed 2/2, then full `scripts/check.ps1` passed syntax checks and all 23 Vue Playwright tests.
- Preserved undated legacy records in the unbounded `全部历史` view; the production build, focused read-only contract, and `git diff --check` passed after that edge-case correction.
- Parallel review identified local-date rollover, tied record ordering, habit target identity, mobile long-title overflow, and clipped overlapping day events. Applied shared local dates, stable tie sorting, `habit=<id>` navigation, anywhere title wrapping, and mobile agenda horizontal scrolling for final re-verification.
- Added a visible `is-target` state on the matching current Habit card so a Records habit event preserves both target identity and user-facing context without introducing new persistence.
- Parallel visual recheck passed after the responsive fixes: mobile document/Records/list containers measured 390/390, 362/362, and 362/362 with the long title contained; the 360px agenda exposes its 402px content through 42px of horizontal scrolling, making the second 160px event fully reachable. Desktop retained 160px event width and 1440/1440 document width.
- Final production build and `git diff --check` passed; final `scripts/check.ps1` passed syntax checks and all 23 Vue Playwright tests after local-date, ordering, habit-target, and responsive fixes.
- Created clean runtime package `life-plan-site-runtime-20260727-232101.zip` and retained the newest five packages per project policy.
- Opened phases 96-100 for Materials parity after comparing the remaining Dashboard and Materials blockers. Selected Materials because the current Vue page uses the wrong required `title` contract and lacks legacy edit, advanced filters, random review, and deletion semantics.
- Final production build, all 22 Vue Playwright tests, and `git diff --check` passed after the textarea correction; created `life-plan-site-runtime-20260727-224426.zip` and retained the newest five packages.
2026-07-27 - Materials visual probe first attempt stopped because Playwright `getByLabel('内容')` also matched a long edit button aria-label containing that word; switched the probe to exact dialog-scoped labels. Product state was unchanged.

## 2026-07-28 - Materials parity closeout

- Resumed the Materials parity stage with phases 97-100 active, worktree changes limited to Materials implementation/tests/docs/planning, and a read-only sidecar reviewing documentation gaps.
- Focused Materials Playwright initially exposed a missing `role="group"` on the random tag picker; added the semantic role and reran `npx playwright test tests/vue-smoke.spec.js --grep "materials"` successfully with 2/2 tests passing.
- Correct 1440x1000 and 390x844 Playwright screenshots/measurements verified the Materials page, filters, random/list grids, long content/tags/source/note wrapping, and editor dialog. The first mobile dialog pass clipped the save button; a Materials-scoped sticky action row fixed it, and the rerun reported no layout-level horizontal overflow.
- `npm run build` passed with 88 transformed modules. `.\scripts\check.ps1` passed syntax checks and all 25 Vue Playwright tests, including both Materials contracts. `git diff --check` passed with only CRLF working-copy warnings.
- Updated the parity checklist and preview guide to record the verified Materials contract while preserving Dashboard and other remaining blockers.
- Created clean runtime package `life-plan-site-runtime-20260728-090558.zip`; package retention removed `life-plan-site-runtime-20260723-230023.zip`.
- Protected refs remained unchanged before commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Dashboard parity stage

- Started phases 101-105 for the next replacement blocker after Materials: Dashboard summary, command center, active-period/timeline navigation, contract tests, responsive verification, docs, package, and commit.
- Audited legacy `renderDashboard()` and found the key missing Vue surface: command center, active period cards, bounded recent timeline, Material/Fitness/Goal/Idea entry points, and ratio-style summary semantics. This slice will stay read-only/navigation-only and leave legacy quick-write buttons for separate audit.
- Implemented a read-only Vue Dashboard command center, ratio summaries, today/floating Todo links, active-period record links, random Material links, active-goal links, Fitness/Tags/Ideas/Todos entry points, and a bounded recent timeline using records, Todo execution sessions, and habit check-ins.
- Added the focused Dashboard Playwright contract for command metrics, navigation restoration, bounded timeline inclusion/exclusion, and exact `lifePlanData` / `todoAppData` immutability; the focused Dashboard run passed 2/2 before responsive cleanup.
- `npm run build` passed and `.\scripts\check.ps1` passed all 26 Vue Playwright tests before the final Dashboard CSS tightening.
- Dashboard visual verification initially hit helper-script issues: Node `spawn EINVAL` when trying to start Vite from the temporary script, then a stale `.dashboard-page` selector. Reused a normal Vite dev server, corrected the script selector to `#page-dashboard`, and kept the script ignored/temporary.
- The first real 1440px visual measurement exposed Dashboard overflow in `.vue-main`, `#page-dashboard`, and `.period-item` with long unbroken titles. Added Dashboard-scoped `min-width: 0`, wrapping, and flex-wrap rules for hero, command rows, Todo rows, active periods, and timeline items.
- Correct 1440x1000 and 390x844 Dashboard screenshots/measurements then passed with no document, `.vue-main`, Dashboard root, command center, command row, Todo link, period item, timeline, or timeline item horizontal overflow. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\dashboard-parity-103455`.
- Final Dashboard verification rerun passed: `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js --grep "dashboard command center"`, full `.\scripts\check.ps1` with 26/26 Vue smoke tests, and `git diff --check` with only LF/CRLF warnings.
- Fresh long-text responsive verification against the local Vite preview passed at 1440x1000 and 390x844 with no overflow in `html`, `body`, `.vue-main`, `#page-dashboard`, command rows, Todo rows, active period cards, or timeline items. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\dashboard-parity-final`.
- A read-only subagent review found no blocking Dashboard slice issue. It noted non-blocking follow-ups for filtered Idea metric links, Goal detail links, and richer Habit timeline landing once those target pages support the deeper route contracts.
- Created clean runtime package `life-plan-site-runtime-20260728-111421.zip`; package retention removed `life-plan-site-runtime-20260724-092318.zip`.
- Protected refs remained unchanged before the Dashboard commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Goals parity stage

- Started phases 106-109 after committing Dashboard stage `a3269ee`. Selected Goals as the next bounded replacement blocker because the surface is smaller than Habit/Wheel but still has concrete legacy detail and tombstone contract gaps.
- Audited legacy `openGoalModal`, `openGoalDetail`, `saveGoal`, `renderGoalList`, `deleteGoal`, and `deleteCurrentGoal` in `app.js`; confirmed the needed Vue fixes are detail/deep-link editing, legacy save payload shape, and `manual-delete` tombstones with the deleted goal name.
- Implemented the Vue Goals detail modal, `goal=<id>` route restoration, legacy empty-period creation default, existing-row save payload without Vue-only timestamps, manual-delete tombstones through `sync-service.js`, and Dashboard goal deep links.
- Added and passed the focused Goals contract test. It covers direct detail restoration, edit payload shape, creation defaults, delete tombstone, and compatible `todoAppData` mirror authority.
- Focused Dashboard+Goals run passed 2/2 after wiring Dashboard goal rows to `#/goals?goal=<id>`.
- `npm run build` passed, then full `.\scripts\check.ps1` passed syntax checks and 27/27 Vue Playwright tests. `git diff --check` passed with only LF/CRLF warnings.
- Goals 1440x1000 and 390x844 visual/overflow checks passed against long goal names/descriptions with no overflow in `html`, `body`, `.vue-main`, `#page-goals`, summary grid, goal cards, modal, editor, or sticky action row. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\goals-parity-final`.
- Final `npm run build` and `git diff --check` passed before packaging. Created clean runtime package `life-plan-site-runtime-20260728-113854.zip`; package retention removed `life-plan-site-runtime-20260727-222706.zip`.
- Protected refs remained unchanged before the Goals commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Search and Tags parity stage

- Started phases 110-113 after committing Goals stage `b475600`. Chose Search/Tags because it is a small-to-medium read-only blocker that ties together already-migrated detail entry points.
- Audited legacy `buildGlobalSearchIndex`, `renderGlobalSearch`, `getTagCenterItems`, and `renderTagCenter`; identified missing Vue parity around grouped module labels, scope filters, exact target routes, template/wheel public item entry points, and combined tag-center scope/search summaries.
- Implemented grouped Vue Search over records, todos, goals, materials, templates, and wheel public items with module scope filtering and exact routes to `record`, `todo`, `goal`, `material`, `template`, and `library` query targets.
- Implemented combined Vue Tags with all/idea/material/wheel summaries, keyword/scope filters, per-tag previews, and read-only jumps to `#/ideas?tag=`, `#/materials?tag=`, and `#/wheel?tag=`.
- Added supporting route restoration for Ideas tag filtering, Records template-manager focus, and Wheel library/tag form focus.
- Added and passed the focused Search/Tags contract. It proves grouped module counts, exact navigation targets, tag-center category jumps, read-only `lifePlanData` immutability, and no mirror creation.
- First full Search/Tags check exposed an old Materials test targeting the removed standalone `素材标签` card; updated it to click the new tag-center card's `素材` button. The focused Search/Tags + Materials regression run then passed 2/2.
- `npm run build` passed, then full `.\scripts\check.ps1` passed syntax checks and 28/28 Vue Playwright tests. `git diff --check` passed with only LF/CRLF warnings.
- Search and Tags 1440x1000 and 390x844 visual/overflow checks passed against long titles/tags/content with no overflow in page, main, search panel/results, or tag-center cards/previews. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\search-tags-parity-final`.
- Final `npm run build` and `git diff --check` passed before packaging. Created clean runtime package `life-plan-site-runtime-20260728-120106.zip`; package retention removed `life-plan-site-runtime-20260727-224426.zip`.
- Protected refs remained unchanged before the Search/Tags commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Import/Export contract stage

- Started phases 114-117 after committing Search/Tags stage `0f779e7`. Selected Import/Export because the UI already exists but checklist still requires broader contracts for mirrors, tombstones, snapshots, and merge semantics.
- Audited legacy `exportData` / `importData` and Vue `lifePlanRepository.mergeImport` / `exportData`. Found two Vue contract gaps: manual import submitted as `source: sync`, leaving main sync dirty state false, and repository commits rebuilt `todoAppData` but not `habitAppData`.
- Implemented the repository fix: all commits now rebuild the Habit compatibility mirror through `LifePlanHabitService`, and manual import merge commits use the default user source so `lifePlanSyncState.dirty` is set for later `/life-plan.json` propagation.
- Added a real Sync-page Import/Export Playwright contract covering file input import, tombstone preservation, before/after snapshots, Todo and Habit mirror rebuilds, dirty sync state, and backup download snapshot/filename.
- Focused `npx playwright test tests/vue-smoke.spec.js --grep "main import export"` passed 1/1. `npm run build` passed. Full `.\scripts\check.ps1` passed syntax checks and all 29 Vue Playwright tests. `git diff --check` passed with only LF/CRLF working-copy warnings.
- Updated the Vue migration checklist and preview guide to close the Import/Export data-safety blocker while leaving replacement blocked by Habits, Wheel, Fitness, remaining Sync, and non-diary AI flows.
- Created clean runtime package `life-plan-site-runtime-20260728-123540.zip`; package retention removed `life-plan-site-runtime-20260727-232101.zip`.
- Protected refs remained unchanged before the Import/Export commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.
- Committed the Import/Export contract stage as `ebd3bd6 feat: harden import export parity`; branch is now ahead of origin by 16 local commits.

## 2026-07-28 - Fitness parity stage

- Started phases 118-122 after committing Import/Export. Selected Fitness because the legacy service already contains bounded multi-exercise plan and plan-writeback contracts, while the Vue page currently exposes only one-exercise plan creation.
- Spawned read-only sidecar agents `Plato` for legacy Fitness contract audit and `Mill` for Vue Fitness/test gap audit.
- Main-thread audit confirmed legacy `fitness-ui.js` supports multi-exercise plan editing, plan-start live workouts, per-set completion, and user-confirmed plan prescription writeback through `fitness-service.js#updatePlanFromWorkout`.
- Implemented Vue Fitness multi-exercise plan create/edit, per-set prescription rows, plan-row editing, explicit finish-time plan writeback, and legacy `manual-delete` tombstone reasons for Fitness deletes.
- Added focused Fitness contract coverage proving multi-exercise plan shape, mirrored `days[0].exercises`, plan-start workout `plannedSets`, no implicit writeback, explicit writeback, dirty sync state, and plan deletion tombstone output.
- First build failed on a removed `planForm.exerciseId` reference and the first two focused contract runs exposed locator scope issues; all were corrected without changing the intended data contract.
- Focused `npx playwright test tests/vue-smoke.spec.js --grep "fitness plans"` passed 1/1. `npm run build` passed with 92 transformed modules. Full `.\scripts\check.ps1` passed syntax checks and all 30 Vue Playwright tests.
- Desktop 1440x1000 and mobile 390x844 Fitness plan-editor and active-workout screenshot/overflow checks passed with no overflow in `html`, `body`, `.vue-main`, `#page-fitness`, forms, plan exercise cards, plan set rows, metric rows, or writeback checkbox. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\fitness-parity-final`.
- Read-only sidecar audits agreed the current bounded slice should close multi-exercise plans and explicit writeback while leaving full history editing, rest timer UX, history suggestion controls, and complete body-metric field editing for later Fitness slices.
- Created clean runtime package `life-plan-site-runtime-20260728-130141.zip`; package retention removed `life-plan-site-runtime-20260728-090558.zip`.
- Protected refs remained unchanged before the Fitness commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.
- Committed the Fitness multi-exercise plan stage as `84d425c feat: add fitness plan parity`; branch is now ahead of origin by 17 local commits.

## 2026-07-28 - Fitness history editor stage

- Started phases 123-127 after the Fitness plan commit. Selected Fitness workout history create/edit because legacy supports manual completed/planned workout logging while Vue currently only lists and deletes completed/skipped workouts.
- Implemented repository-backed Fitness workout history create/edit with date, status, title, duration, plan association, notes, multi-exercise rows, per-set weight/reps/done, and existing-history editing.
- Added focused history coverage proving plan-derived `plannedSets`, create/edit in place, dirty sync state, no `fitnessAppData` mirror, and legacy `manual-delete` workout tombstones.
- Focused `npx playwright test tests/vue-smoke.spec.js --grep "fitness history"` passed 1/1. `npm run build` passed with 92 transformed modules. Full `.\scripts\check.ps1` passed syntax checks and all 31 Vue Playwright tests.
- Desktop 1440x1000 and mobile 390x844 Fitness history create/edit screenshot/overflow checks passed with no overflow in `html`, `body`, `.vue-main`, `#page-fitness`, history forms, exercise cards, workout set rows, or history metric rows. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\fitness-history-final`.
- Created clean runtime package `life-plan-site-runtime-20260728-131237.zip`; package retention removed `life-plan-site-runtime-20260728-111421.zip`.
- Protected refs remained unchanged before the Fitness history commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Habit correction stage

- Started phases 128-132 after confirming the worktree was clean at `2429907` and the branch remained `migration/vue-app-v1` ahead of origin by 18 commits.
- Selected Habit local correction parity as the next bounded blocker: note checkins, backfill, note editing, and undo latest checkin can be verified without opening the larger independent remote sync state machine.
- Main-thread audit confirmed legacy `app.js` uses `appendHabitCheckin`, `submitHabitNoteModal`, `decreaseCheckin`, `reverseHabitCheckinReward`, `reverseHabitPenaltiesForDate`, and `dualWriteHabitAppLocalMirror` for these flows.
- Implemented Vue Habit correction controls and store actions for note/backfill checkins, note editing, and undo-latest checkin with reward reversal, same-date penalty reversal, `manual-decrease` checkin tombstones, dirty main sync state, and local-only `habitAppData` mirror rebuilding.
- Added focused Habit Playwright coverage for quick checkin plus the note/backfill/edit/undo local correction contract; focused `npx playwright test tests/vue-smoke.spec.js --grep "habit"` passed 2/2.
- Production `npm run build` passed with 92 transformed modules. Full `.\scripts\check.ps1` passed syntax checks and all 32 Vue Playwright tests.
- Desktop 1440x1000 and mobile 390x844 Habit correction screenshot/overflow checks passed with no overflow in `html`, `body`, `.vue-main`, `#page-habits`, Habit cards, correction form, or note rows. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\habit-correction-final`.
- Read-only sidecar `Poincare` failed before review with upstream `429 Too Many Requests`; main-thread review and verification continued, and the sidecar made no file changes.
- `git diff --check` passed with only LF/CRLF warnings. Created clean runtime package `life-plan-site-runtime-20260728-140806.zip`; package retention removed `life-plan-site-runtime-20260728-113854.zip`.

## 2026-07-28 - Habit base management stage

- Started phases 133-137 after the Habit correction commit `6f439c3`; two attempted read-only sidecars for Habit contract/UI audit failed with model-capacity errors, so the main thread continued the bounded audit and implementation.
- Audited legacy `openHabitModal`, `editCurrentHabit`, `saveHabit`, and `deleteCurrentHabit`: base edit updates comparable habit fields and retags habit shadow records, while delete writes a `habits` tombstone plus related `checkins` tombstones and removes related checkins/shadow records.
- Implemented Vue Habit base create/edit/delete through `src/stores/habitsStore.ts` and `src/pages/HabitsPage.vue`, preserving reward/penalty/milestone fields, keeping `lifePlanData` authoritative, dirtying main sync state, and rebuilding local-only `habitAppData`.
- Polished the Habit page by adding a unified base-management form, an all-habits management table, a small edit shortcut on today cards, and a narrower correction panel that stays usable on desktop and mobile.
- Added focused Playwright coverage proving habit update fields, preserved wallet fields, stale habit-record cleanup, delete tombstones, checkin removal, dirty state, and canonical `habitAppData` mirror tombstones.
- Focused `npx playwright test tests/vue-smoke.spec.js -g "habit quick|habit note|habit base"` passed 3/3. `npm run build` passed with 92 transformed modules. Full `.\scripts\check.ps1` passed syntax checks and all 33 Vue Playwright tests.
- Desktop 1440x1000 and mobile 390x920 Habit management screenshot checks passed for the edit form, all-habits table, and correction panel. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\019fa748-12b4-7f41-9a97-394d8bc2a01c`.
- `git diff --check` passed with only LF/CRLF warnings. Created clean runtime package `life-plan-site-runtime-20260728-153553.zip`; package retention removed `life-plan-site-runtime-20260728-120106.zip`.
- Protected refs remained unchanged before the Habit base management commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Wheel canvas interaction stage

- Started phases 138-142 after the Habit base commit `695e336`; a read-only Wheel sidecar failed through the local proxy before returning findings, so the main thread completed the bounded legacy/Vue audit.
- Audited Wheel canvas and tag-mode behavior: legacy click/drag spins a drawn wheel, tag mode first selects an enabled public tag, then selects an enabled public library item under that tag.
- Implemented Vue Wheel canvas rendering in `src/pages/WheelPage.vue`, including weighted segments, canvas labels, pointer drag rotation, keyboard/click spin entry points, and tag first-stage candidate-label/result wording.
- Added focused Playwright coverage proving canvas pixels, normal-wheel click history, drag spin history, tag first-stage lock, second-stage result, Todo conversion, `todoAppData` mirror rebuild, and main dirty state.
- Focused `npx playwright test tests/vue-smoke.spec.js -g "wheel canvas"` passed 1/1. Full `.\scripts\check.ps1` passed syntax checks and all 34 Vue Playwright tests.
- Desktop 1440x1000 and mobile 390x900 Wheel normal/tag screenshot checks passed with painted canvas pixels and no `#page-wheel` or document-level overflow. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\019fa748-12b4-7f41-9a97-394d8bc2a01c\wheel-canvas-stage`.
- Final `npm run build` passed with assets `dist/assets/index-c-C3NQZh.css` and `dist/assets/index-1RBUs_-N.js`. `git diff --check` passed with only LF/CRLF warnings. Created clean runtime package `life-plan-site-runtime-20260728-163445.zip`; package retention removed `life-plan-site-runtime-20260728-123540.zip`.
- Protected refs remained unchanged before the Wheel canvas commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-28 - Wheel public-library batch stage

- Started phases 143-147 after the Wheel canvas commit `6e2c0df`; a read-only Wheel public-library sidecar failed with upstream `503 Service Unavailable`, so the main thread completed the bounded audit and implementation.
- Audited legacy `wheel-tool.js` public-library management: tag filtering, selected-visible count, selected set cleanup, batch tag add/remove, batch enable/disable, batch delete, and the only-tag removal guard.
- Implemented Vue public-library tag filtering, visible selection, selected count, quick batch tag picks, batch tag add/remove, batch enable/disable, and batch delete in `src/pages/WheelPage.vue` backed by repository writes in `src/stores/wheelStore.ts`.
- Added focused Playwright coverage proving filtered selection, batch tag add/remove, only-tag guard, enable/disable, `wheelLibraryItems` tombstones, and dirty main sync state.
- Focused `npx playwright test tests/vue-smoke.spec.js -g "wheel public library"` passed 1/1. `npm run build` passed with assets `dist/assets/index-qX1Uh49p.css` and `dist/assets/index-CCe0Sgda.js`. Full `.\scripts\check.ps1` passed syntax checks and all 35 Vue Playwright tests.
- Desktop 1440x1000 and mobile 390x1000 Wheel public-library batch screenshot checks passed with no `#page-wheel` or document-level overflow. Screenshots are under `C:\Users\lihao\.codex\visualizations\2026\07\28\019fa748-12b4-7f41-9a97-394d8bc2a01c\wheel-library-batch-stage`.
- `git diff --check` passed with only LF/CRLF warnings. Created clean runtime package `life-plan-site-runtime-20260728-172150.zip`; package retention removed `life-plan-site-runtime-20260728-130141.zip`.
- Protected refs remained unchanged before the Wheel public-library commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Wheel remote preview/apply stage

- Started phases 148-152 on `migration/vue-app-v1` after confirming `master`, `experiment/vue-preview-poc`, and the protected materials stash were not modified.
- Added the Vue Wheel independent sync panel on the Sync page with the fixed `/apps/wheel-app/data.json` path, unified endpoint reuse, restored-config reset to `autoSync: false` / `remoteUploadEnabled: false`, and no upload/create path in this slice.
- Implemented GET-only remote preview with schema risk reporting, local/cloud/merged hash summaries, tombstone-aware `sync-service.js.mergeWheelSnapshots`, and no `lifePlanData` mutation during preview.
- Implemented apply with a second GET recheck, cloud-race refusal with `lastConflictAt`, application-before snapshots, `lifePlanWheelSyncState` updates, and main `lifePlanSyncState.dirty` propagation after local authority changes.
- Added focused Playwright coverage for GET-only preview, fixed path/config reset, merge persistence across wheels/tags/library/history/tombstones, dirty states, snapshot creation, and stopping before persistence when the cloud changes after preview.
- Fixed the existing Habit correction contract test to compute today/yesterday dynamically, because the hard-coded 2026-07-28 date became a backfill after the real date advanced to 2026-07-29.
- Verified `npm run build`, focused Wheel remote tests 2/2, focused Habit date-drift regression 1/1, full `npm run test` 37/37, and `git diff --check` with only LF/CRLF warnings.
- Verified the Sync page with the Wheel sync panel at 1440x900 and 390x900: document, `.vue-main`, `.page.active`, and `.wheel-sync-card` all had zero horizontal overflow. Screenshots are under `test-results/wheel-sync-1440.png` and `test-results/wheel-sync-390.png`.

## 2026-07-29 - Wheel protected upload/create stage

- Started phases 153-157 after commit `4266925`; the working tree was clean on `migration/vue-app-v1`, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation.
- Extended `src/components/WheelSyncPanel.vue` with protected existing-file upload and session-armed first creation for `/apps/wheel-app/data.json`; restored `lifePlanWheelSyncConfig` still forces `autoSync: false` and `remoteUploadEnabled: false`.
- Existing upload now re-GETs the Wheel remote, refuses PUT if the remote hash changed since preview, requires ETag, writes with `If-Match`, performs GET readback hash verification, and clears `lifePlanWheelSyncState.dirty` only after verification.
- First creation now appears only after a missing-file preview and current-session checkbox, rechecks absence immediately before writing, uses `If-None-Match: *`, performs readback verification, and does not retry uncertain PUT outcomes automatically.
- Added focused Playwright coverage for Wheel existing upload, upload-race refusal before PUT, and first creation; tests verify request sequences, conditional headers, uploaded snapshot contents, fixed config reset, and verified sync state.
- Verified `npm run build`, focused Wheel protected upload/create tests 3/3, full `npm run test` 40/40, and `git diff --check` with only LF/CRLF warnings.
- Verified ready and missing Wheel sync states at 1440x900 and 390x900: document, `.vue-main`, `.page.active`, and `.wheel-sync-card` all had zero horizontal overflow. Screenshots are under `test-results/wheel-sync-upload-ready-1440.png`, `test-results/wheel-sync-upload-ready-390.png`, `test-results/wheel-sync-upload-missing-1440.png`, and `test-results/wheel-sync-upload-missing-390.png`.

## 2026-07-29 - Wheel management polish stage

- Started phases 158-162 after commit `a419d0d`; the working tree was clean on `migration/vue-app-v1`, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation.
- Polished `src/pages/WheelPage.vue` management surfaces with a non-persisted summary for wheel/tag/library/history counts and labeled option, tag, and public-library item forms.
- Kept the slice contract-neutral: edit buttons fill form state only, and the focused Playwright contract verifies that `lifePlanData` remains byte-for-byte unchanged and `todoAppData` is not created.
- Strengthened responsive wrapping for long wheel option, tag, and public-library item names plus mobile management form/action layouts.
- Added focused Playwright coverage for the management summary and edit-form focus behavior; the focused test passed 1/1 and the full Vue smoke suite passed 41/41 during implementation.
- Verified desktop 1440x1000 and mobile 390x1000 Wheel management layouts with no horizontal overflow for document, `.vue-main`, `#page-wheel`, `.wheel-management-summary`, `.wheel-management-grid`, or `.library-card`. Screenshots are under `test-results/wheel-management-polish-1440.png` and `test-results/wheel-management-polish-390.png`.
- Final `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js -g "wheel management forms"`, full `.\scripts\check.ps1` with 41/41 Vue smoke tests, and `git diff --check` passed with only LF/CRLF working-copy warnings.
- Created clean runtime package `life-plan-site-runtime-20260729-102209.zip`; package retention removed `life-plan-site-runtime-20260728-153553.zip`.
- Protected refs remained unchanged before the Wheel management polish commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Fitness body metrics full-field stage

- Started phases 163-167 after commit `6efd977`; the working tree was clean on `migration/vue-app-v1`, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation.
- Expanded the Vue Fitness body metric form to use `fitness-service.js` `METRIC_FIELDS` and `CONDITION_OPTIONS`, covering weight, body fat, chest, waist, hips, arm, thigh, calf, shoulder, height, date, condition, and note.
- Added metric edit mode plus wrapping recent-metric chips while keeping `lifePlanData.bodyMetrics` authoritative and avoiding any `fitnessAppData` mirror.
- Added focused Playwright coverage for full-field create/edit/delete, numeric normalization, dirty sync state, `bodyMetrics` manual-delete tombstones, and no mirror creation.
- First focused test attempted to assert that clearing an existing metric field deletes it, but `fitness-service.js#upsertBodyMetric` intentionally falls back to the existing record for missing fields; the test was adjusted to preserve that legacy service behavior and verify updates instead.
- Verified desktop 1440x1000 and mobile 390x1000 Fitness body metric layouts with no horizontal overflow for document, `.vue-main`, `#page-fitness`, `.fitness-body-field-grid`, or `.fitness-body-metric-row`. Screenshots are under `test-results/fitness-body-metrics-1440.png` and `test-results/fitness-body-metrics-390.png`.
- Final `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js -g "fitness body metrics"`, full `.\scripts\check.ps1` with 42/42 Vue smoke tests, and `git diff --check` passed with only LF/CRLF working-copy warnings.
- Created clean runtime package `life-plan-site-runtime-20260729-120906.zip`; package retention removed `life-plan-site-runtime-20260728-163445.zip`.
- Protected refs remained unchanged before the Fitness body metrics commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Fitness live workout assist stage

- Started phases 168-172 after commit `25d7666`; the working tree was clean on `migration/vue-app-v1`, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation.
- Audited the legacy Fitness live session helpers in `fitness-ui.js` and the shared service functions in `fitness-service.js`: `findLastExercisePerformance`, `suggestSetValues`, `completeWorkoutSet`, and `getExerciseRestSec`.
- Added Vue live-workout last-performance hints, per-set `套用建议` actions, and a page-local rest timer with +30s, -30s, and skip controls.
- Kept the service/data contract unchanged: suggestion apply writes weight/reps into the active `fitnessWorkouts` set without completing it, completed sets still go through `fitness-service.js#completeWorkoutSet`, and timer state is not persisted.
- Added focused Playwright coverage for suggestion text, suggestion apply, in-progress workout persistence, dirty sync state, rest timer display/controls, and set completion.
- Verified desktop 1440x1000 and mobile 390x1000 Fitness live assist layouts with no horizontal overflow for document, `.vue-main`, `#page-fitness`, the active workout card, `.vue-fitness-rest-timer`, or `.fitness-live-row`. Screenshots are under `test-results/fitness-live-assist-1440.png` and `test-results/fitness-live-assist-390.png`.
- Final `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js -g "fitness live workout suggestions"`, full `.\scripts\check.ps1` with 43/43 Vue smoke tests, and `git diff --check` passed with only LF/CRLF working-copy warnings.
- Created clean runtime package `life-plan-site-runtime-20260729-124113.zip`; package retention removed `life-plan-site-runtime-20260728-172150.zip`.
- Protected refs remained unchanged before the Fitness live workout assist commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Habit remote read-only preview stage

- Started phases 173-177 after commit `3e28dca`; the working tree was clean on `migration/vue-app-v1`, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation.
- Added `src/components/HabitSyncPanel.vue` and mounted it on `src/pages/SyncPage.vue`, reusing `lifePlanSyncConfig.webdavUrl` with fixed `/apps/habit-app/data.json`.
- The panel forces `habitAppSyncConfig.autoSync` and `remoteUploadEnabled` off, builds local preview from `LifePlanHabitService.buildHabitAppSnapshotPreview`, GETs the remote only, and shows local/remote/merged Habit snapshot counts and hashes through `sync-service.js` helpers.
- Strict read-only contract: no PUT/create/apply path, no `lifePlanData` mutation, no `habitAppData` mirror write, and no `habitAppSyncState` write.
- Added focused Playwright coverage proving exactly one GET, safe config reset, and byte-for-byte unchanged `lifePlanData`, `habitAppData`, and `habitAppSyncState`.
- Verified `npm run build`, focused Habit remote preview 1/1, full `.\scripts\check.ps1` with 44/44 Vue smoke tests, and `git diff --check` with only LF/CRLF warnings.
- Verified desktop 1440x1000 and mobile 390x1000 Sync page layouts with Browser plugin unavailable and regular Playwright fallback: no console errors and zero horizontal overflow for document, `.vue-main`, `.page.active`, `.habit-sync-card`, and `.habit-sync-comparison`. Screenshots are under `test-results/habit-sync-preview-1440.png` and `test-results/habit-sync-preview-390.png`.
- Created clean runtime package `life-plan-site-runtime-20260729-132845.zip`; package retention removed `life-plan-site-runtime-20260729-094524.zip`.
- Protected refs remained unchanged before the Habit remote read-only preview commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Habit remote apply-to-local stage

- Started phases 178-182 after commit `2ca5572`; the working tree had only the in-progress `src/components/HabitSyncPanel.vue` change, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before continuing.
- Used multi-agent sidecars to audit context risk, Habit apply mapping/race contracts, and tests/docs needs; integrated the findings by keeping preview strictly read-only and replacing the early hand-written reverse mapping with legacy-equivalent `buildLegacyHabitDataFromSnapshot` behavior.
- Added guarded Vue Habit apply-to-local in `src/components/HabitSyncPanel.vue`: apply requires a second GET, refuses cloud hash races before snapshots or persistence, confirms with the user, creates `应用 Habit 云端合并结果前`, applies the merged canonical snapshot into legacy `habits`, `checkins`, `habitPointLedger`, `habitRewards`, `habitCurrencies`, and legacy tombstones, then rebuilds `habitAppData`.
- Preserved the no-cloud-write boundary: preview remains one GET and no local state mutation; apply performs two GETs and zero PUTs, keeps `habitAppSyncConfig.remoteUploadEnabled` false, and only updates `habitAppSyncState` after apply or conflict.
- Added focused Playwright coverage for successful apply, non-`life-plan/...` remote ID preservation, weekly/reward/tombstone field mapping, `habitAppData` local-only rebuild, main dirty state, snapshot creation, and cloud-change refusal with byte-for-byte unchanged local data/mirror.
- Verified `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js -g "habit remote"` with 3/3 passing, focused Wheel regression `npx playwright test tests/vue-smoke.spec.js -g "wheel canvas click drag"` with 1/1 passing, full `.\scripts\check.ps1` with 46/46 Vue smoke tests, and `git diff --check` with only LF/CRLF warnings.
- Verified desktop 1440x1000 and mobile 390x1000 Sync page layouts with regular Playwright fallback: no console errors and zero horizontal overflow for document, `.vue-main`, `.page.active`, `.habit-sync-card`, and `.habit-sync-comparison`. Screenshots are under `test-results/habit-sync-apply-1440.png` and `test-results/habit-sync-apply-390.png`.
- Created clean runtime package `life-plan-site-runtime-20260729-143057.zip`; package retention removed `life-plan-site-runtime-20260729-100134.zip`.
- Protected refs remained unchanged before the Habit remote apply commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Habit protected existing upload stage

- Started phases 183-187 after commit `34f47ad`; the working tree was clean on `migration/vue-app-v1`, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation.
- Added Vue Habit existing-file protected upload to `src/components/HabitSyncPanel.vue` while keeping preview strictly read-only and leaving session-armed first creation out of scope.
- Upload now rebuilds the local Habit app snapshot from legacy `lifePlanData`, second-GETs `/apps/habit-app/data.json`, compares the remote hash with the preview baseline, requires remote ETag plus explicit confirmation, writes with `If-Match`, and immediately GETs the remote file again to verify hash equality.
- Preserved safety boundaries: restored `habitAppSyncConfig.autoSync` and `remoteUploadEnabled` stay false; cloud-race refusal stops before PUT and records `lastConflictAt`; uncertain PUT failures report without automatic retry.
- Added focused Playwright coverage proving successful upload uses `GET, GET, PUT, GET`, includes the `If-Match` header, uploads the local Habit snapshot, writes `dirty: false`/remote ETag metadata, and resets config flags; race refusal uses only `GET, GET` and preserves local `lifePlanData`.
- Verified `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js -g "habit .*remote|habit existing"` with 5/5 passing, full `.\scripts\check.ps1` with 48/48 Vue smoke tests, and `git diff --check` with only LF/CRLF warnings.
- Verified desktop 1440x1000 and mobile 390x1000 Sync page layouts with regular Playwright fallback: no console errors and zero horizontal overflow for document, `.vue-main`, `.page.active`, `.habit-sync-card`, `.habit-sync-actions`, and `.habit-sync-comparison`. Screenshots are under `test-results/habit-sync-upload-1440.png` and `test-results/habit-sync-upload-390.png`.
- Created clean runtime package `life-plan-site-runtime-20260729-145733.zip`; package retention removed `life-plan-site-runtime-20260729-102209.zip`.
- Protected refs remained unchanged before the Habit protected existing upload commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Habit session-armed first create stage

- Started phases 188-192 after commit `877ae96`; the working tree had only the in-progress `src/components/HabitSyncPanel.vue` first-create change, and protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before continuing.
- Updated the heartbeat goal and automation to require multi-agent sidecars, progress-percentage reporting, protected refs, small verified stages, commits, pushes, and append-only dual-store memory.
- Added Vue Habit missing-file first creation to `src/components/HabitSyncPanel.vue`: a current-session `本次会话允许首次创建` arm appears only after a missing `/apps/habit-app/data.json` preview, resets on every check/attempt, and keeps restored `autoSync` plus `remoteUploadEnabled` forced off.
- First creation now rebuilds the local Habit snapshot from legacy-authoritative `lifePlanData`, second-GETs the fixed path to confirm it is still absent, confirms with the user, writes with `If-None-Match: *`, then immediately GET-verifies that the remote Habit hash matches the uploaded snapshot.
- Preserved safety boundaries: final-recheck races stop before PUT and leave local data/sync state unchanged; HTTP 412 or uncertain PUT/readback failures report without automatic retry; successful create records clean `habitAppSyncState` metadata.
- Added focused Playwright coverage proving successful first create is disabled until armed, uses `GET, GET, PUT, GET` with `If-None-Match: *`, uploads the local Habit snapshot, resets config flags, and that final-recheck races use only `GET, GET` with no local mutation.
- Verified `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js -g "habit remote"` with 3/3 passing, focused `npx playwright test tests/vue-smoke.spec.js -g "habit first remote"` with 2/2 passing, full `.\scripts\check.ps1` with 50/50 Vue smoke tests, and `git diff --check` with only LF/CRLF warnings.
- Verified desktop 1440x1000 and mobile 390x1000 Sync page layouts with regular Playwright fallback: no unexpected console/page errors and zero horizontal overflow for document, `.vue-main`, `.page.active`, `.habit-sync-card`, `.habit-sync-arm`, and `.habit-sync-comparison`. Screenshots are under `test-results/habit-sync-first-create-1440.png` and `test-results/habit-sync-first-create-390.png`.
- Created clean runtime package `life-plan-site-runtime-20260729-152830.zip`; package retention removed `life-plan-site-runtime-20260729-120906.zip`.
- Protected refs remained unchanged before the Habit first-create commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-29 - Habit advanced reward fields stage

- Started phases 193-197 after commit `aa9f9eb`; protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation, and the in-progress Habit advanced field diff was preserved instead of switching modules.
- Exposed Vue Habit advanced management fields for fixed rewards, reward currency, penalty points/currency, random reward ranges, break-penalty mode/value/currency, and the legacy 7/15/21/30/90/180/365-day milestone rows.
- Extended `src/stores/habitsStore.ts` create/update normalization to persist advanced reward, penalty, break-penalty, and milestone fields instead of resetting them during a basic edit.
- Added currency preservation support so referenced reward, penalty, break-penalty, and milestone currencies are present in `lifePlanData.habitCurrencies` while keeping `lifePlanData.habits` authoritative.
- Extended the focused Habit management Playwright contract to edit advanced fields, persist milestone rewards, create currencies, preserve record/checkin cleanup, rebuild local-only `habitAppData`, and mark main sync dirty.
- Verified `npm run build`, focused `npx playwright test tests/vue-smoke.spec.js --grep "habit base edit"` with 1/1 passing, full `.\scripts\check.ps1` with 50/50 Vue smoke tests, and `git diff --check` with only LF/CRLF warnings.
- Verified desktop 1440x1000 and mobile 390x1000 Habits advanced form layouts with no horizontal overflow for document, `.vue-main`, `#page-habits`, `.habit-management-card`, `.habit-editor-form`, `.habit-advanced-fields`, or `.habit-milestone-editor`. Screenshots are under `test-results/habit-advanced-fields-1440.png` and `test-results/habit-advanced-fields-390.png`.
- Created clean runtime package `life-plan-site-runtime-20260729-155944.zip`; package retention removed `life-plan-site-runtime-20260729-143057.zip`.
- Protected refs remained unchanged before the Habit advanced reward fields commit: `master` at `38f885f08ecf11bbf55f588cf7baaed2a505bc0d`, `experiment/vue-preview-poc` at `d5daf32d752dcf681ccda68c121f05ce2dad6e20`, and `stash@{0}` at `260eef5dfbd45348487f01d0cc103c906a22cb1f` with title `wip-materials-page-v1-before-vue-preview-experiment`.

## 2026-07-30 - Ideas editable pre-create Todo draft

- Kept work on `migration/vue-app-v1`; protected `master`, `experiment/vue-preview-poc`, and stash materials WIP untouched.
- Replaced immediate Ideas-to-Todo create with editable pre-create draft via `#/todos?ideaDraft=<id>`.
- Updated `src/pages/IdeasPage.vue`, `src/pages/TodosPage.vue`, and `src/stores/todosStore.ts` create options.
- Save links through `recordsStore.linkIdeaTodo` and rebuilds `todoAppData`; cancel/close stays read-only.
- Focused Playwright idea conversion tests 2/2 passed; full suite 51/51 passed; vue-tsc and vite build passed.

## 2026-07-30 - Ideas AI next-action and todo breakdown

- Kept work on `migration/vue-app-v1`; protected `master`, `experiment/vue-preview-poc`, and materials stash untouched.
- Expanded `src/pages/AiPage.vue` with mode tabs for chatCapture, ideaNext, and todoBreakdown plus editable draft confirmation.
- Added `recordsStore.applyIdeaAiActions` for confirmed idea-ai Todo creation, idea link/status/next-action updates, and mirror rebuild.
- Playwright covers ideaNext generate no-write then confirmed writeback, and todoBreakdown confirmed subtask append.
- Focused AI/idea conversion tests 4/4 passed.

## 2026-07-30 - Main auto sync and visibility resume

- Added `src/services/mainCloudSync.ts` for main both-direction auto sync, 20s debounce, 5-minute visible interval, and visibility resume.
- Bound the engine from `src/App.vue` and user commits in `src/stores/lifePlanStore.ts`; Sync page now saves `autoSync` and can force one run.
- Playwright covers debounce upload with If-Match, visibility resume, and autoSync-off idle behavior.


## 2026-07-30 - AI chatCapture multi-destination writeback stage

- Started phases 198-202 after commit `7a9f788`; `HEAD` and `origin/migration/vue-app-v1` were confirmed at `7a9f788e98646b4b97e0089c4b3064b6a7f3d194` after `git push origin migration/vue-app-v1` returned `Everything up-to-date`.
- Protected `master`, `experiment/vue-preview-poc`, and `stash@{0}` were read-only checked before implementation and remained unchanged.
- Used multi-agent sidecars: `Halley` as a read-only context sentinel and `Banach` as a read-only legacy/Vue `chatCapture` parity auditor.
- Added Vue `chatCapture` editable multi-destination drafts for Todo, diary, work record, day plan, and idea capture in `src/pages/AiPage.vue`.
- Added Records-store writeback helpers in `src/stores/recordsStore.ts` so diary append/create, same-day day-plan append/create, work record create, and idea capture all persist through `lifePlanData` and the repository commit path.
- Preserved generation as read-only until explicit confirmation; Todo writeback uses `sourceType: ai-capture`, diary creation uses `builtin-diary-daily-review`, same-day `日计划` reuses the scoped record, and idea capture writes `ideaStatus: 待整理` plus `ideaTags: ['AI整理']`.
- Added focused Playwright coverage proving no-write generation, per-target confirmed writes, Todo mirror rebuild, main dirty state, scoped day-plan reuse, structured diary content, and idea fields.
- Updated Vue migration parity docs and preview notes to mark chatCapture multi-destination writeback as covered while leaving older AI plan/triage depth as follow-up.
- Verification passed: `npx vue-tsc -b --pretty false`; focused `npx playwright test tests/vue-smoke.spec.js -g "AI chatCapture"` 1/1; `npm run build`; focused `npx playwright test tests/vue-smoke.spec.js -g "AI|diary AI"` 17/17; full `./scripts/check.ps1` 57/57; `git diff --check` with LF/CRLF warnings only.
- Responsive verification passed at 1440x1000 and 390x1000 with zero horizontal overflow for document, `.vue-main`, `#page-ai`, `.ai-capture-section-list`, `.ai-result-list`, and `.ai-result-item`; screenshots are under `test-results/ai-chat-capture-1440.png` and `test-results/ai-chat-capture-390.png`.
- Did not run `scripts/package-clean.ps1` because Vue artifact packaging must not use the legacy static runtime packaging script; `dist/` production build is the artifact verification for this slice.

## 2026-07-31 - Fitness browse index shell (in progress)

- Started the next bounded UI/IA slice on `migration/vue-app-v1` after confirming the tree only contains the user's untracked `previews/` directory.
- Prior two local commits are still ahead of origin; the first push retry failed with a GitHub connection reset and will be retried after this slice.
- Scope is intentionally read-only: add a compact browse index under the existing Fitness overview hero with plan, recent workout, body metric, and exercise-library summaries plus scroll-to-section actions; keep all existing forms and service/data contracts unchanged.
- Added `browseItems` and `browseTo()` in `src/pages/FitnessPage.vue`, rendering four compact browse items below the overview hero and preserving all existing form visibility and selectors.
- Added focused Playwright coverage in `tests/vue-smoke.spec.js` for the four summaries and action-to-library scroll behavior.
- `npm run build` passed; Fitness focused smoke passed 5/5; `git diff --check` passed with only LF/CRLF working-copy warnings.

## 2026-07-31 - Fitness hero secondary actions (in progress)

- Started the next bounded Fitness shell slice while the prior `6ff7e7d` commit remains locally ahead of origin because Git upload is unavailable.
- Scope: add `记录身材` and `补记训练` secondary hero actions that reuse existing scroll/reset helpers; no service, store, or persistence changes.
- Added the two secondary actions in `src/pages/FitnessPage.vue` and covered both destinations in `tests/vue-smoke.spec.js`.
- `npm run build` passed; Fitness focused smoke passed 6/6; `git diff --check` passed with only LF/CRLF working-copy warnings.
- Committed as `1f0370c` and pushed successfully to `origin/migration/vue-app-v1`; remote now includes both Fitness browse-first shell commits.

## 2026-07-31 - Wheel management shell audit (in progress)

- Fitness browse-first minimum is closed for this pass: overview hero, secondary actions, four browse summaries, and section jump behavior are all covered.
- Next bounded slice targets Wheel management IA only; canvas rendering, public-library behavior, and sync/data contracts stay untouched.
- Added a management landing strip to `src/pages/WheelPage.vue` with the existing stats moved above the full editor dump and scoped workspace jump buttons.
- Added focused coverage in `tests/vue-smoke.spec.js` for landing visibility and Public Library navigation while preserving existing management form selectors.
- `npm run build` passed; Wheel focused smoke passed 4/4 (canvas/tag, public library batch, management forms, landing); `git diff --check` passed with only LF/CRLF working-copy warnings.
- Committed as `6768b0b` and pushed successfully to `origin/migration/vue-app-v1`.

## 2026-07-31 - Habits analysis summary audit (in progress)

- Wheel management IA slice is closed with the remote branch synchronized.
- Next slice is read-only Habits analysis depth: derive a compact per-habit summary from existing checkins/streak helpers and keep all write paths untouched.
- Added `analysisHabitSummaries` and a responsive `习惯统计摘要` block to `src/pages/HabitsPage.vue`, derived solely from the existing 30-day matrix cells.
- Added read-only Playwright coverage for per-habit checkin count, active days, consecutive days, and unchanged `lifePlanData`/mirror state.
- First assertion only differed by rendered whitespace (`2次打卡`); adjusted the locator to allow optional whitespace without weakening persistence checks.
- `npm run build` passed; focused Habit analysis/diagnostics/base tests passed 3/3.
- Read-only sidecar review caught that “连续 N 天” could imply target completion for multi-count/non-daily habits; clarified the field and label to `连续有打卡 N 天` before push.

## 2026-07-31 - Fitness browse-first disclosure shell (in progress)

- Online parity audit confirmed legacy Fitness opens body/workout editing through secondary actions while Vue rendered those forms inline.
- Wrapped body metrics and workout-log surfaces in native disclosure shells, default closed; existing hero actions and edit-row handlers open/reset the relevant section before scrolling.
- Updated only locator entry steps in the existing history/body focused tests; persistence assertions remain unchanged.
- `npm run build` passed; all Fitness focused smoke passed 6/6.
- Committed as `2e908cf` and pushed successfully; the previously pending Habits summary commit `31ff0e1` is now also present on origin.

## 2026-07-31 - Fitness trend summary shell (in progress)

- Online legacy comparison shows two remaining read-only Fitness overview cues: recent weight change and weight/waist trend summaries.
- Scope is limited to derived display values from existing `bodyMetrics`; no new persistence, mirror, or service write path.
- Reused `fitness-service.js` `buildBodyMetricSummary()` and `formatSignedChange()` for weight/waist deltas, with a responsive two-card summary beneath the Fitness KPIs.
- Added focused no-write coverage for `+1.5 kg` weight and `-0.5 cm` waist changes; all Fitness tests remain green.
- `npm run build` passed; Fitness focused smoke passed 7/7; `git diff --check` passed with only LF/CRLF working-copy warnings.

## 2026-07-31 - Wheel empty-stage audit (in progress)

- Fitness trend summary is locally committed as `d09c242`; push is currently retrying around intermittent GitHub 443 failures.
- Online audit found legacy Wheel keeps a visible canvas stage on empty data, while Vue hides the stage with `v-if="selectedWheel"`.
- Next slice will add a no-write empty stage with a clear create action; it must not seed or mutate `lifePlanData` automatically.
- Added a `v-else` Wheel empty stage with a real canvas, explicit `还没有转盘` state, and a no-write `新建转盘` entry to the existing management form.
- Added focused coverage proving the canvas is visible, the create entry scrolls to `#wheel-create-panel`, and `lifePlanData` remains byte-identical.
- `npm run build` passed; Wheel focused smoke passed 5/5 (canvas/tag, library batch, management forms, landing, empty stage).
- Full-suite diagnosis found stale locators after the existing collapsed sidebar/management IA: updated the three Wheel auto-sync tests to open management, scoped import file input to `导入并合并`, and scoped navigation to sidebar buttons for `AI 助手`/`云同步`.
- Regression group `Vue shell navigates|main import export|wheel conditional auto sync|wheel empty state` passed 7/7. The full run still has one date-sensitive AI chatCapture fixture failure unrelated to this shell change.
- Final local state: `HEAD=f7e86fe`, `origin/migration/vue-app-v1=2e908cf`; verified commits `d09c242` and `f7e86fe` are not yet pushed because repeated GitHub HTTPS 443 resets/timeouts persisted. Untracked `previews/`, `tmp-legacy.png`, and `tmp-vue.png` were never staged.

## 2026-08-01 - Import/Export, Dashboard, and Wheel checkpoint

- Reconciled API-generated remote history with local history using non-business merge commit `fd431bf`; no force push was used and protected refs stayed unchanged.
- Import/Export: normalized parsed backup data before the confirmation summary through `LifePlanRepository.normalizeImportPreview`; added `main import summary normalizes legacy shadow records before confirmation`. Commit `913f246`, remote ref verified.
- Dashboard: added legacy note/decrease action branches to today-habit cards, reusing `habitsStore` check-in, note-edit, undo, ledger, tombstone, and local mirror paths. Commit `9e3af7b`, remote ref verified.
- Wheel: rejected deletion of the final wheel with the legacy minimum-one message and added no-write UI coverage. Commit `c2212ba`, remote ref verified.
- Verification: Import/Export focused `5/5`, Dashboard focused `3/3`, Wheel focused `5/5`, `npm run build` after each slice, Vue dist packages created with `scripts/package-vue-dist.ps1 -SkipBuild`, and full `scripts/check.ps1` passed `147/147`.
- Current next candidate: Records independent read-only preview or Fitness plan-day selection; untracked `previews/`, `tmp-legacy.png`, and `tmp-vue.png` remain untouched.

## 2026-08-02 - Whole-project documentation checkpoint

- Current whole-project engineering completion estimate is **96.5%** after this documentation closeout. This is the entire active Vue project percentage, not the completion of the latest slice; live deployment switching is outside scope and is not counted as pending work.
- Re-audited the stale next-candidate entry: Records independent preview is already implemented and covered, while legacy and Vue Fitness both currently use the first plan day, so neither remains a confirmed parity blocker.
- Closed the Fitness live-workout queue with legacy four-column live-set structure, set action labels/styles, `-15s` / `+15s` rest controls, primary skip action, and timer expiry cleanup. Local commits are `90ddcf9`, `231a0ec`, and `28bc21e`; their force-free Git Data API equivalents were verified on the remote branch.
- Final current gates passed: Fitness focused coverage, `npm run build`, `git diff --check`, `npm run package:vue`, and full `tests/vue-smoke.spec.js` **214/214**. The generated artifact was `life-plan-site-vue-dist-20260802-101004.zip`.
- No open blocker remains in the current core replacement audit. The two explicit non-blocking specialist candidates are Wheel public-library AI tag-suggest and deeper Habit diagnostics repair / dual-write readiness tooling.
- From this checkpoint onward, work is single-agent and serial. Each implementation slice must update its tests and migration documentation together, and report the whole-project percentage at both start and finish.
- Existing untracked `.freebuff/`, `previews/`, `tmp-legacy.png`, and `tmp-vue.png` remain untouched.

## 2026-08-02 - Wheel AI tag-suggest closeout

- Whole-project engineering completion moved from **96.5% to 97.5%**. This is the entire active Vue project percentage, not the Wheel slice percentage.
- Re-audit found Vue already had the core `wheelTagSuggest` local/remote implementation. The closeout restored the persistent legacy help/result presentation, recommendation colors and selected styling, and explicit transient-state cleanup when editing, cancelling, or saving.
- Focused coverage now proves local suggestions are draft-only, remote payloads include existing tags and library samples, invented remote tags are discarded, manual tag changes stay authoritative, remote failures fall back locally, and no `lifePlanData` write occurs before save.
- Final gates passed: Wheel AI focused **3/3**, `npm run build`, full Vue smoke **216/216**, `git diff --check`, and `npm run package:vue`; the generated artifact is `life-plan-site-vue-dist-20260802-111622.zip`.
- Wheel public-library AI tag-suggest is no longer a specialist follow-up. The remaining user-visible specialist item is deeper Habit diagnostics repair / dual-write readiness tooling; build chunk and Vite CJS warnings remain technical cleanup.
- Existing untracked `.freebuff/`, `previews/`, `tmp-legacy.png`, and `tmp-vue.png` remain untouched.

## 2026-08-02 - Habit safe diagnostics repair

- Whole-project engineering completion moved from **97.5% to 99%**. This is the entire active Vue project percentage, not the Habit slice percentage.
- Added a deterministic repair preview and confirmed action for orphan/future check-ins, invalid ledger amounts, and empty ledger/reward currencies. The repair creates a local snapshot first, writes check-in tombstones, rebuilds the local-only `habitAppData` mirror, and marks main sync dirty.
- Duplicate or missing IDs and orphan wallet references remain visible blockers and are never auto-merged or guessed. Cancelling confirmation keeps authority, mirror, snapshots, and sync state unchanged; after repair the clean action is disabled/no-op.
- Focused diagnostics coverage passes **2/2**; `npm run build`, full Vue smoke **217/217**, `git diff --check`, and `npm run package:vue` pass. The generated artifact is `life-plan-site-vue-dist-20260802-113228.zip`.
- After this slice the only planned remaining work is build technical cleanup: route-level lazy chunks and removal of the Vite CJS warning.
- Existing untracked `.freebuff/`, `previews/`, `tmp-legacy.png`, and `tmp-vue.png` remain untouched.

## 2026-08-02 - Build technical cleanup and scope closeout

- Whole-project engineering completion moved from **99% to 100%** for the documented active Vue scope. Live deployment switching remains excluded by user request.
- Converted all migrated routes to lazy page imports. The entry JavaScript bundle dropped from about **653 kB** to about **281 kB**, with page chunks emitted separately and no chunk-size warning.
- Renamed `vite.config.ts` to explicit ESM `vite.config.mts`; the Vite CJS Node API deprecation warning no longer appears.
- Strengthened the all-routes smoke to fail on page exceptions or failed lazy-chunk requests while preserving route titles and hash navigation. The first full run exposed two Records leave-save timing regressions under lazy routing; route-leave guards now synchronously flush existing editors and new-record drafts before navigation.
- Final verification passed: Records navigation focused **2/2**, production build with no CJS/chunk warning, full Vue smoke **217/217**, `git diff --check`, and `npm run package:vue`. The final artifact is `life-plan-site-vue-dist-20260802-114758.zip`.
- Existing untracked `.freebuff/`, `previews/`, `tmp-legacy.png`, and `tmp-vue.png` remain untouched.
## 2026-08-03 master-to-Vue re-audit

- Started from `migration/vue-app-v1` after checking status and existing planning context.
- Found 13 commits present on `master` but not on the Vue branch; current dirty Wheel files are user-owned and will be preserved.
- Next: inspect the complete master-only patch and compare each affected module with the Vue implementation before editing.
- First source pass confirms the master changes affect both Materials and the whole Wheel surface, so the audit remains module-wide rather than limited to one filter control.
- Confirmed a likely parity defect: legacy seed initialization is called from the page path, while the Vue seed helper is currently uncalled.
- Implemented seed initialization, private-item field correction, and selected-wheel/mode synchronization; updated the empty-data and cross-module regression expectations to match `master`.
- Production build passed. The first wheel grep run timed out after exposing the stale no-write assertion; the assertion and seed-field defect are now fixed, and focused reruns are next.

## 2026-08-03 - Master-to-Vue re-audit closeout

- Rechecked the full master-only Materials and Wheel patch against Vue source, stores, tests, and live browser pages. Preserved existing dirty files and untracked preview artifacts.
- Fixed Wheel default seed lifecycle, private/public seed field separation, selected-wheel/mode synchronization, stale list filter expectations, viewport-safe tag dropdown positioning, and missing Wheel management form/list styles.
- Updated `tests/vue-smoke.spec.js` for the legacy seed contract, mode-first tag flow, expanded batch controls, and normal/tag-only list filtering.
- Verification passed: `npm run build`; Wheel 34/34; Materials 5/5; full `npm test` 219/219; `git diff --check`; `npm run package:vue`.
- Visual verification used the preview server at `http://127.0.0.1:5175`, with Wheel main/library/list and Materials screenshots plus desktop/mobile overflow checks. Artifact: `life-plan-site-vue-dist-20260803-175211.zip`.

## 2026-08-03 - Vue sync re-audit

- Started from the current worktree and preserved user-owned Wheel changes/untracked preview artifacts.
- Compared `master:app.js` with Vue sync modules and traced the legacy sync lifecycle.
- Confirmed the likely behavioral gap: master immediately syncs on startup and after saving configuration; Vue currently does neither.
- Next: run focused browser request-sequence checks before editing implementation.
- Browser probe setup reached the local Vite page, but the first inline Node script failed before launch because stdin does not allow top-level `await`; retrying with an async wrapper.
- The async-wrapped bare Node Playwright probe timed out before emitting a trace; switched to the repository's Playwright runner instead of repeating the same harness.
- Repository Playwright verification passed: Sync page configuration tests 3/3; main sync and auto-sync tests 7/7.
- Final diagnosis: Vue omits the master startup sync and post-save sync calls. No production code was changed in this diagnostic pass; the local probe server was stopped and port 5173 verified free.

## 2026-08-03 - Vue sync repair

- User authorized implementation and later direct release after the master/Vue audit.
- Restored master-compatible immediate main sync after Vue startup and after saving the main sync configuration in `src/App.vue`, `src/pages/SyncPage.vue`, and `src/services/mainCloudSync.ts`.
- Added the missing standalone outer sidebar reminder in `src/components/AppSidebar.vue`, including full status text/time and summary labels for pending, syncing, success, and failure states.
- Added regression coverage for startup/config-save request sequences, remote changes, legacy config migration, status events, and the full sidebar reminder; focused coverage passed `10/10`.
- Verification passed: `npm run build`, full Vue smoke `223/223`, `git diff --check`, and `npm run package:vue`.
- Generated artifact: `life-plan-site-vue-dist-20260803-214454.zip`.
- Deployment remains local artifact validation only; no live production switch or push was performed.

## 2026-08-03 - Vue Records timeline action parity

- Rechecked the reported behavior against the legacy flow: the initial timeline has no edit/view controls, while the Vue Records list incorrectly added per-row `查看/预览` and `删除` buttons after navigation.
- Removed those list-level actions and retained deletion in the existing record editor, preserving the legacy confirmation and relationship cascade behavior.
- Updated `tests/vue-smoke.spec.js` to assert no row actions after timeline navigation and to exercise preview/edit/delete through the row/editor flow.
- Verification passed: targeted `3/3`, full Vue smoke `223/223`, production build, `git diff --check`, and `npm run package:vue`.
- Generated artifact: `life-plan-site-vue-dist-20260803-222647.zip`.
- Next release step: commit this slice and push `migration/vue-app-v1`.
