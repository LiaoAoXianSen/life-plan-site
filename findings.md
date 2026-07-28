# Findings

## 2026-07-27 - Vue migration continuation

- Current authoritative branch is `migration/vue-app-v1` at `cc18d62`, clean and matching `origin/migration/vue-app-v1`.
- Protected state is intact: `master` remains at `38f885f`, `experiment/vue-preview-poc` remains at `d5daf32`, and `stash@{0}` remains `wip-materials-page-v1-before-vue-preview-experiment`.
- `docs/vue-migration-parity-checklist.md` is the current replacement-candidate acceptance source. It explicitly requires persisted data-shape regression coverage and treats build/route smoke success as insufficient.
- The last verified slices are the records editor contract (`50898e7`) and protected main sync (`cc18d62`).
- Todos are the next bounded blocker: Vue has basic CRUD/filter/toggle/delete and `todoAppData` mirror rebuild, while detail editing, subtasks, sessions, and record/idea relationship views remain incomplete.
- No development or Playwright process was running when this continuation began, and the worktree had no staged or unstaged changes.
- Desktop/mobile screenshot review found that the legacy Todo filter grid assumed eight controls while Vue renders three, compressing the mobile controls. Vue now overrides that grid to three desktop columns and one mobile column.
- Screenshot review also found unstyled detail-row delete actions; the Vue detail panel now supplies local link-button danger/focus states without changing legacy styles.
- The legacy Todo filters can be reused directly through `todos-service.js.isTodoInDateRange`; Vue only lacks start/end, group, and exclusive/shared controls.
- `RecordsPage.vue` already owns `openEditor()`. A `record` route query can restore a specific editor without changing record data, and clearing the editor should remove that query so back/refresh behavior stays predictable.
- Legacy schedule parity requires three Todo item types: `todo-plan` for every date in the plan range, `todo-due` on the due date, and `todo-session` for each execution record. Vue currently has only sessions.
- Dashboard today/floating Todo labels are not detail links in Vue, while legacy opens the same Todo detail from both lists.
- Legacy date presets are draft-only until save: today, tomorrow, this week (today through Sunday), next week (Monday through Sunday), and no date.
- `CalendarViews` can keep navigation policy outside the generic renderer by emitting the selected `ScheduleItem`; `RecordsPage` opens record items locally and routes all `todo-*` items to the shared Todo detail URL.
- A focused Playwright contract now proves Dashboard navigation, direct URL restoration, query cleanup, draft-only presets, and plan/due/session calendar navigation all target one Todo without changing `lifePlanData` or creating `todoAppData`.
- Record/Todo relationships remain record-owned: ordinary links use `record.todoIds`, while idea-origin links use `record.ideaTodoId`.
- The legacy Todo detail can delete a Todo and clean both fields but does not expose relationship unlink controls. Vue Todo-side editing should therefore mutate record fields directly and protect an exclusive Todo's source relationship from unlinking.
- Legacy Todo independent sync uses fixed `/apps/todo-app/data.json`, `todoAppSyncConfig`, and `todoAppSyncState`; it reuses the unified main endpoint and keeps auto-sync disabled.
- The required network contracts are GET-only preview, preview-bound merge apply with a second GET, `If-Match` for an existing remote file, and session-armed `If-None-Match: *` for first creation, followed by GET verification.
- `todos-service.js` already owns canonicalization, hash payloads, dual-write consistency, and tombstone-aware snapshot merging. Vue should call these APIs rather than reproduce merge rules.
- `LifePlanRepository` already rebuilds `todoAppData` after commits; exposing that existing method gives independent-sync preflights the same mirror contract without importing `app.js`.
- Applying an independent Todo remote merge changes authoritative `lifePlanData` and must mark the main `lifePlanSyncState.dirty` flag true; treating it like a main-remote pull would silently skip propagation to `/life-plan.json`.
- Legacy Todo cloud apply explicitly asks again when its rollback snapshot cannot be created; the Vue port must not silently continue without that recovery point.


## 2026-07-23

- Real-data verification screenshot exposed a false consistency blocker: legacy `deletedItems` counted all 284 application tombstones, while the habit mirror correctly contained only canonicalizable habit-related tombstones, producing `旧 284 / 镜像 0` despite habits, records, ledger, and balance matching.
- The correction belongs in `buildHabitDualWriteConsistency()`: its legacy Tombstone count must use the same canonicalizable habit-tombstone predicate as `buildHabitAppSnapshot()`. The broader source hash may still include all deletions so any legacy source change triggers a safe mirror rebuild.

- The handoff identifies `lifePlanData` as the current habit authority and `localStorage.habitAppData` as a fully rebuilt local mirror; this phase must never reverse-write mirror data into legacy fields.
- The requested remote path is `/apps/habit-app/data.json`; the first live network capability is GET-only preview, with no PUT and no automatic save of merged data.
- Existing untracked `.zcode/` content belongs to the user and must remain untouched.
- The project has no `PRODUCT.md`; this scoped diagnostics enhancement will use the existing product UI and stylesheet conventions rather than initializing a new design system.
- `app.js` already persists guarded `habitAppSyncConfig` / `habitAppSyncState`, exposes a diagnostics scaffold around lines 7042–7220, and forcibly keeps `autoSync` and `remoteUploadEnabled` false on load/save.
- `sync-service.js` already provides `pullJson`, `getHabitSnapshot`, `getHabitDataHash`, and `mergeHabitSnapshots`; `pullJson` maps HTTP 404 or an empty response to `null` and otherwise performs one GET.
- Existing diagnostics smoke coverage already checks read-only legacy behavior, local mirror bootstrap, disabled upload, and scaffold labels; the new regression can extend this area with request interception and storage snapshots.
- The preview result should remain in-memory only. Avoiding `saveHabitSyncState()` means a manual preview cannot quietly mutate any local sync metadata while claiming to be read-only.
- Remote schema validation must run against the raw pulled JSON before `getHabitSnapshot()` fills absent collections with empty arrays; otherwise missing-field risks would be invisible.
- UI direction: keep the existing restrained diagnostics vocabulary, add an inline status region and compact comparison table beneath the actions, and avoid a modal or decorative motion for a state/reporting interaction.
- Read-only review confirmed no reachable PUT path. It also caught that schema validation must cover all 13 collections from `sync-service.js`, including `habitMilestones`, `habitMoodNotes`, and `habitTimeTasks`; the final implementation now does so.
- Entering diagnostics may still perform the existing one-time local mirror bootstrap. The stricter guarantee is that the remote GET result and merged preview are never persisted.
- The end goal is a shared `/apps/habit-app/data.json` authority for PC and mobile, but the next safe increment is only remote bootstrap. Legacy `lifePlanData` must remain authoritative until bidirectional sync and mobile compatibility are proven.
- User's live screenshot confirmed the remote habit file currently returns 404, making a guarded create-only first upload the safest next operation.
- `sync-service.pushJson()` already forwards `ifNoneMatch` to the direct PUT request, so first creation can use `If-None-Match: *` and fail with HTTP 412 if another client creates the file after the final GET.
- `pushJson()` may issue a best-effort MKCOL before PUT. The protected-upload test must allow that setup request but still assert exactly one habit-file PUT and require the conditional header.
- Existing config loading forcibly resets `remoteUploadEnabled=false`; keep that durable behavior and use a session-only arming function rather than persisting an enabled upload flag.
- User clarified they have not manually changed sync configuration for habit. This is expected: habit sync must reuse the existing shared `syncConfig.webdavUrl` and only supply its own relative path; do not add a second endpoint field or require edits to `/life-plan.json`.
- The live screenshot shows the shared endpoint already resolves `GET /apps/habit-app/data.json` and currently returns `404`; no separate habit endpoint setup is needed.
- `If-None-Match: *` is only a best-effort guard with the current Worker because Cloudflare KV performs a non-atomic `get` followed by `put`. The client must use a final GET, a single conditional PUT, and a post-PUT GET/hash verification, while avoiding any claim of strict atomic create-only semantics.
- Legacy habit tombstones must be converted to canonical `{ collection, id, deletedAt }` entries. The previous `{ id: tombstone-id, targetCollection, targetId }` shape was normalized against the tombstone's own ID and could fail to suppress remote entities.
- Protected upload must additionally block missing checkin IDs, unstable ledger IDs/source IDs, danger diagnostics, provider mode that drops conditional options, and local mirror drift.

## 2026-07-14

- `sync-service.js` only uses the configured endpoint and remote path; sync username/password were UI/config leftovers and did not affect requests.
- Removing unused sync credentials is safer than implementing Basic Auth because the current app-specific sync path is a Cloudflare Worker JSON endpoint, not a general WebDAV credential flow.
- Main data import already used safe merge plus pre/post import snapshots, but it continued when the pre-import snapshot failed; this now requires an explicit user confirmation.
- Wheel JSON restore was the remaining high-risk import path: it overwrote wheel collections directly and only saved afterward. It now asks before overwriting, snapshots first, and rolls back if saving the restored data fails.
- Wheel restore is still intentionally an overwrite restore rather than a merge import; a future merge mode would need a separate design for wheel item identity, tag conflicts, and history deduplication.

## 2026-07-13

- Current continuation is on `master` and focuses on data safety/sync reliability, not new AI feature expansion.
- Save failures now need to be treated as a visible reliability state, not a transient alert; the UI keeps recovery actions visible until a successful retry.
- Snapshot creation should not attempt a second write inside the failure handler because quota failures can repeat; returning `null` and showing failure is the safer behavior.
- Sync requests can hang under poor Cloudflare/network conditions, so both the local sync service and vendored AppSyncKit request path need the same 20-second abort behavior.
- A save or sync request during an active sync can otherwise be lost when the first sync clears `dirty`; a pending follow-up sync is required for both main data and wheel data.
- The current batch closes the save/snapshot/timeout/queue risks, while data size stats, IndexedDB snapshot migration, persistent sync error history, and ETag-based conflict prevention remain future work.

## 2026-07-07

- Current AI integration goal is project-bound to `D:\project\life-plan-site`.
- User wants AI added with direct URL + key binding and explicitly requested goal-based operation plus multi-agent parallelism.
- Saved pre-AI workspace backup at `D:\project\life-plan-site-version-backups\life-plan-site-pre-ai-20260707-142843.zip`.
- Created branch `codex/ai-integration` after saving the backup.
- Initial subagent using inherited `gpt-5.5` errored via local proxy HTTP 400; two replacement read-only explorers were spawned with `gpt-5.4-mini`.
- AI settings persist in browser `localStorage` under `lifePlanAiConfig` and stay outside synced `lifePlanData`.
- OpenAI-compatible Base URL handling accepts endpoints like `https://ai2.hhhl.cc/v1` and requests `https://ai2.hhhl.cc/v1/chat/completions`.
- User explicitly limited this continuation to AI-related closeout; non-AI follow-up polish remains deferred.
- AI closeout validation passed on 2026-07-07 with `node --check .\app.js` and `npx playwright test tests/smoke.spec.js --grep "AI"`.
- Clean runtime package created at `D:\project\life-plan-site\life-plan-site-runtime-20260707-154052.zip`.
- A later non-AI continuation attempt was a scope misunderstanding and was reverted; keep this thread focused on AI work.
- User later explicitly requested todo and idea module fixes, reopening non-AI scope.
- Todo detail now has a main-task completion toggle and refreshed subtask checking behavior covered by smoke tests.
- Idea-to-todo conversion now uses an editable draft and avoids using long idea content as the todo title by default.
- Idea pool default sort pushes `已验证` ideas behind active ideas while preserving explicit status filtering.
- Clean runtime package created after these fixes at `D:\project\life-plan-site\life-plan-site-runtime-20260707-164418.zip`.
- Subagent review found no blocking functional issue and prompted added coverage for canceling idea drafts plus explicit `已验证` / `待实践` filters.
- Final clean runtime package after added coverage: `D:\project\life-plan-site\life-plan-site-runtime-20260707-165355.zip`.
- Repeated "发现本地更新，已上传" after refresh was traced to sync/local hash drift risks: habit currency normalization could regenerate default-currency timestamps, render-only currency option generation mutated `data.habitCurrencies`, and auto sync treated a missing `lastRemoteHash` as local changes even when local and remote hashes matched.
- `webdavRequestWithConfig()` also joined a base URL without a trailing slash incorrectly; sync URLs now work for both `https://host` and `https://host/`.
- Added smoke coverage proving auto sync performs a GET but no PUT for unchanged data, and records a matching remote hash instead of uploading identical first-seen data.
- Clean runtime package after sync fix: `D:\project\life-plan-site\life-plan-site-runtime-20260707-172407.zip`.
- Diary AI analysis now uses the existing AI assistant and daily-review diary template, returning suggested diary fields (`review`, `tomorrow`, optional `oneLine` / `improve` / `thinking` / `smallJoy`) plus optional todos.
- Diary AI write-back is explicitly user-confirmed: generated suggestions do not modify `lifePlanData` until the user clicks a write/create action.
- Full project check after diary AI revealed the next separate wheel issue: right-top management menu tests time out when clicking menu items in `#wheel-action-menu`; this should be fixed in the wheel phase, not bundled into the diary AI commit.
- Wheel management regression root cause: the right-top `管理` menu HTML existed, but menu open/close handlers and modal rendering flow were missing, and the stage summary layer could intercept menu clicks without a higher `.wheel-mode-bar` stacking layer.
- Wheel management should remain right-top modal-based; the deprecated bottom management panel was not restored.
- Wheel page screenshot feedback: the `管理` button felt wrong because the 1080px breakpoint forced the top controls into one column too early; pre-spin summary also over-emphasized low-value stats, so the summary and empty result state were compacted.

## 2026-07-08

- P3 was clarified as a maintainability split: `app.js` should stop accumulating sync, records, todos, AI, snapshots logic.
- Safe first split is sync plus snapshots because these areas contain mostly pure service/storage logic and already have smoke coverage around merge, tombstones, auto sync, and wheel snapshots.
- Records/todos/AI remain good candidates for later extraction, but they are currently more tightly coupled to DOM state, modal forms, and inline handlers; they should be split in smaller future passes rather than forced into this sync/snapshot change.
- User clarified that P3 should not be considered complete until all five named areas have files: `sync-service.js`, `snapshot-service.js`, `records-service.js`, `todos-service.js`, and `ai-service.js`.
- The safe boundary for this P3 pass is service/business-rule extraction while keeping DOM rendering, modal state, and inline onclick compatibility in `app.js`; full UI event-system extraction remains a separate future refactor.

## 2026-07-06

- Project root is `D:\project\life-plan-site`.
- Existing root contains many old zip artifacts, including `life-plan-site-clean-*`, `life-plan-site-runtime-*`, and one larger `life-plan-site-sync-kit-20260705.zip`.
- User wants future work to always create a lean runtime zip after fixes and not preserve lots of old packages.
- User wants habit defaults changed: new habits should not grant coins by default.
- User wants periodic cyclic habit rewards, e.g. 7, 15, 21, 30 days, quarter, half-year, one year, repeating; milestone rewards can use different currencies; reward items can require a specific currency.

- The next safe habit increment after first upload is a guarded PC -> cloud sync path when the cloud file already exists. It should rebuild the local mirror, re-GET the cloud file, require a baseline match against the last known remote hash, and use conditional If-Match writes rather than opening automatic upload.
- Browser CORS must expose the remote ETag header for the habit sync path; otherwise the client can only fall back to the saved lastRemoteEtag, which is safe but less fresh.
- Cloud-to-PC apply does not require changing the Worker or adding another sync URL: the existing GET path is sufficient because the new action only reads cloud data and writes local browser data after confirmation.
- Exact post-apply habit hash equality is too strict while PC still stores legacy-compatible defaults such as note mode, start date, and sort fields. The apply path should use hashes to guard stale previews before mutation, then rebuild the local mirror and surface the resulting actual preview/state instead of blocking on byte-identical canonical hash round-trips.
- External/mobile canonical IDs must survive the PC legacy bridge. Storing `remoteId` on legacy habit/checkin/ledger/reward rows lets the mirror builder preserve cross-device identity without treating arbitrary legacy IDs containing `/` as canonical IDs.
- Legacy Records defines six built-in structured templates with stable IDs: `builtin-diary-daily-review`, `builtin-day-plan-focus`, `builtin-weekly-review`, `builtin-monthly-review`, `builtin-idea-capture`, and `builtin-work-log-daily`.
- Structured field values are transient editor state. Legacy persistence stores generated heading-based Markdown in `record.content` plus the built-in `record.templateId`; normalization reconstructs old `templateFields` only when content is empty, then deletes `templateFields`.
- Custom templates persist `{ id, name, type, content, todos }`. Applying one clones Todo IDs; deleting one removes it from `templates` and writes a `deletedItems` tombstone for collection `templates`.
- Legacy idea detail state remains record-owned through `ideaStatus`, `ideaTags`, `ideaNextAction`, `ideaTodoId`, and `ideaConclusion`; changing a record away from `灵感碎片` clears all five fields on save.
- Legacy Ideas filters support ordinary statuses plus `unprocessed` (`待整理` / `待实践`), `needsConclusion` (`实践中` / `已验证` without a conclusion), and partial case-insensitive tag matching through `records-service.js`.
- Vue `IdeasPage.vue` currently updates status and creates a Todo directly, but cannot edit the other idea fields, filter by tag/special states, deep-link to the Records editor, or open the linked Todo detail.
- Legacy considers `ideaTodoId` linked only when the referenced Todo still exists; a stale imported ID must not block creating a replacement Todo or navigating to a valid detail.
- Legacy record autosave debounces editor changes for 3 seconds, persists dirty changes immediately when closing, cancels the pending timer before preview/close, and reports the autosave clock time after success.
- The current Vue Records editor edits existing records inline, while new records still use a separate explicit-submit form. Existing-record autosave can match debounce and close/switch/navigation flush semantics without creating a second draft store; new-record modal/draft parity remains a later scope.
- Legacy Records filtering is a real remaining blocker, not only missing documentation: the page has fixed record type options plus `待办` / `习惯`, a day-order selector, idea status and partial tag filters, and a 7/30/90/all list range defaulting to 30 days.
- Legacy record keyword matching covers type, title, content, start/end dates, normalized idea status/tags, next action, and conclusion. Vue currently omits both dates and the idea next/conclusion fields.
- The legacy Records list and day/week/month views include records, Todo execution sessions, and one aggregated checked-habit event per habit/date. Legacy excludes Todo plan-range and due-date events, but Vue commit `43c36a2` intentionally added those two calendar entry points and protects them with a read-only cross-entry test; this accepted calendar superset must remain while the list follows legacy inclusion exactly.
- Applying either idea-only filter excludes Todo and habit operation events, and all Records filters are transient read-only UI state: they must not rewrite `lifePlanData` or create compatibility mirrors.
- Legacy `全部历史` has no date predicate at all, so undated historical records remain visible there even though every bounded recent/calendar view excludes them; Vue now keeps that compatibility edge instead of simulating unbounded dates with sentinel strings.
- Parallel review found that Records and CalendarViews still derived today through UTC ISO dates, which is wrong before 08:00 in Asia/Shanghai; both now use the shared local `getTodayStr()` contract, and the test fixture independently formats local dates.
- Same-day all-day records need `getRecordSortValue`-compatible secondary ordering when their minute values tie. Schedule items now carry that stable value, while timed layout remains chronological.
- Mobile visual measurement found long unbroken titles widened the Records list and overlapping fixed-width day events extended beyond a hidden agenda boundary. Record titles now wrap anywhere, and the mobile agenda exposes horizontal scrolling while desktop keeps the accepted 160px event width.
- Legacy Materials has no `title` field: `content` is the only required user field, alongside fixed `type`, normalized `tags`, `source`, `note`, `createdAt`, and `updatedAt`. The current Vue form incorrectly requires a title and cannot edit existing old-format rows.
- Legacy Materials filters type exactly, tags by partial case-insensitive match, keywords across type/content/source/note/tags, and sorts by `createdAt` descending. All filtering is transient and read-only.
- Random review selects up to three unique rows from the union of materials matching any selected tag; no selected tag means the whole collection. Random refresh and tag selection must never persist data.
- Material deletion writes a `deletedItems(collection=materials)` tombstone with `reason: manual-delete`. A dedicated store path is needed because the generic Vue remover currently emits `vue-delete-materials`.
- Vue Materials now normalizes old string tags, invalid types, missing IDs, and missing timestamps into the legacy contract while keeping `content` as the only required field and omitting `title`.
- Search routes Material results to `#/materials?material=<id>` and Tags exposes a separate Material-tags section to `#/materials?tag=<tag>`; this closes the bounded Material entry-point gap without claiming full Search/Tags parity.
- Correct 1440px and 390px visual checks show Materials page, filter controls, random/list grids, long content/tags/source/note, and the editor dialog within viewport width; the mobile dialog uses a sticky action row so delete/cancel/save remain visible.
- Legacy Dashboard renders more than summary cards: it calls `renderDashboardCommandCenter()`, `renderTodayTodos()`, `renderFloatingTodos()`, `renderTodayHabits()`, `renderActivePeriods()`, and `renderTimeline()`.
- Legacy Dashboard summary counts today's relevant Todos including overdue, due today, planned today, and sessions today; it displays completed/total Todo and habit ratios, active goals, week records, and fitness snippets.
- Legacy Dashboard command center surfaces unprocessed ideas, ideas needing conclusion, urgent/overdue Todos, two random Materials, active goal progress, and fitness snippets with navigation to Ideas, Todos, Tags, Materials, Goals, and Fitness.
- Legacy Dashboard timeline uses a bounded recent range and `buildScheduleItemsForRange()` with records, Todo execution sessions, and checked-habit items, while excluding Todo plan/due items. Vue can reuse `src/utils/schedule.ts` for this contract.
- Legacy Dashboard active-period cards open record preview for 周/月/年复盘/计划 plus 3年计划/终身愿景 records whose `endDate` is future or absent. Vue should route them to the shared Records editor via `#/records?record=<id>`.
- The next bounded Vue Dashboard stage will keep all new Dashboard additions read-only and navigation-only so the exact `lifePlanData` string remains unchanged during Dashboard browsing.
- Vue Dashboard now restores the read-only command-center slice: unprocessed ideas, ideas needing conclusion, high-pressure Todos, random Materials, active goals, Tags, Materials, Fitness, Ideas, Todos, and Goals entry points route to migrated pages without writing storage.
- Vue Dashboard summary semantics now use ratios for today's relevant Todos and due Habits, count active goals, and count records from the current week; this mirrors the legacy ratio-first Dashboard without adding Dashboard-owned persistence.
- Vue Dashboard recent timeline now uses the shared schedule builder over a bounded 14-day window with records, Todo execution sessions, and checked-habit events, while excluding Todo plan/due-only items for this page.
- Dashboard quick-write parity remains intentionally open: legacy actions such as direct Todo completion, habit check-in, and other write-heavy shortcuts need a separate audited slice before any replacement decision.
- Read-only Dashboard review found no blocking data-contract issue after implementation. Follow-up parity can deepen Ideas metric links from plain `#/ideas` into filtered states, Goals rows from plain `#/goals` into target detail, and Habit timeline links once the migrated Habits page has a fuller historical/detail landing surface.
- Legacy Goals uses a modal/detail flow for both create and edit. Saves persist `name`, `period`, `target`, `status`, `progress`, and new `createDate`; existing saves do not add Vue-only timestamp fields.
- Legacy Goals deletion uses `markDeletedItem('goals', id, { reason: 'manual-delete', name })`; the current Vue page used `vue-delete-goal`, so Goals parity needs a tombstone contract correction before replacement.
- Legacy search and Dashboard goal rows call `openGoalDetail(goal.id)`. Vue Goals should restore a `goal=<id>` route/deep-link target so cross-module entry points can land on a specific editable goal.
- Read-only Goals review found no blocking issue after implementation. It caught two useful legacy-depth corrections that were included in the slice: new Goals preserve the legacy empty `period` default, and Dashboard goal rows now route to `#/goals?goal=<id>`.
- A separate read-only replacement audit estimated Vue replacement readiness at roughly 72%-78% by risk-weighted surface after Dashboard and near-closed Goals. The largest remaining blockers are advanced Habits and Habit remote flow, full Sync auto/independent flows, Wheel canvas/remote conflict parity, Fitness advanced planning/history, non-diary AI writebacks, Search/Tags full index parity, and broader Import/Export contracts.
- Legacy Search builds grouped module results for records, todos, goals, materials, templates, and wheel public items. The replacement-critical Vue gap was not raw search existence, but precise module labels, tag/meta matching, and navigation to migrated detail/query targets.
- Legacy Tag Center aggregates only idea tags, material tags, wheel tag definitions, and wheel public items by tag. Vue now mirrors that read-only scope and routes to Ideas, Materials, and Wheel tag/library landing states without mutating `lifePlanData`.
- Legacy manual import snapshots before and after merge, uses tombstone-aware `mergeCloudData`, then saves as a local/user data change. Vue Import/Export needed broader proof that manual imports mark the main sync state dirty, refresh compatibility mirrors, and do not revive tombstoned rows.
- Vue repository commits previously rebuilt only `todoAppData`; Import/Export parity requires habit imports to refresh `habitAppData` as a compatibility mirror while keeping `remoteUploadEnabled: false`.
- The verified Vue fix keeps `lifePlanData` authoritative, rebuilds `todoAppData` and `habitAppData` from that authority on repository commits, and treats manual file import as a user-side dirty change rather than a clean remote sync pull.

## 2026-07-28 Fitness parity audit

- After Import/Export closeout, replacement readiness is roughly 80% by risk-weighted surface: core Todos, Records, Dashboard, Goals, Search/Tags, Materials, main protected upload, Todo independent sync, and Import/Export now have contract coverage; Habits, Wheel, Fitness, remaining Sync, and non-diary AI remain the main blockers.
- Legacy Fitness UI in `fitness-ui.js` supports multi-exercise plan editing with per-exercise set rows, action-library insertion, manual exercise creation, status/goal/notes, and legacy `fitnessPlans[].exercises` plus mirrored `days[0].exercises`.
- Legacy live workouts can start from an entire plan, preserve `planId` / `planName`, complete sets across multiple exercises, and after finish ask whether changed prescription data should be written back through `fitness-service.js#updatePlanFromWorkout`.
- Current Vue `FitnessPage.vue` only creates one-exercise plans and one-exercise free workouts, while `fitness-service.js` already exposes the needed multi-exercise and writeback contract helpers.
- The next bounded Fitness slice should reuse `fitness-service.js` rather than adding new data rules: implement multi-exercise plan editing and user-confirmed plan writeback on finish, leaving full rest timer/history editing polish for later audited slices.
- Legacy workout history editing supports completed/planned/skipped logs with `date`, `status`, `title`, `durationMin`, `notes`, plan association, multi-exercise rows, per-set `weight`/`reps`/`done`, and manual-delete tombstones. Vue can close this without a modal by using an inline repository-backed form that calls `fitness-service.js#upsertFitnessWorkout`.
- Fitness should not create a `fitnessAppData` mirror. Any create/edit/delete must dirty the main sync state through the shared repository path and keep `lifePlanData` authoritative.

## 2026-07-28 Habit correction audit

- Legacy Habit checkins have three local correction paths before remote sync: `append-checkin` for today notes/backfill, `edit-checkin-note` for note-only edits, and `decrease-checkin` / `toggle-checkin` for undoing the latest checkin on a date.
- Undoing a checkin removes the row from `lifePlanData.checkins`, writes a `deletedItems(collection=checkins, reason=manual-decrease, habitId)` tombstone, and adds `reverse` ledger rows for prior checkin and milestone rewards keyed by the removed checkin ID.
- Backfill/checkin must reject future dates, preserve single-per-day habits by refusing duplicate checkins, reverse existing miss/break penalties for that date, update the habit timestamp, mark main sync dirty, and rebuild `habitAppData` as a local mirror with `remoteUploadEnabled: false`.
- Legacy Habit base edit loads and saves the comparable payload for `name`, `rule`, `weekdays`, `count`, `timesPerDay`, `tag`, `goalCount`, `noteMode`, reward/penalty fields, break penalties, and milestone rewards. The bounded Vue base form now edits the non-wallet fields and deliberately preserves existing reward/penalty/milestone fields instead of exposing a partial wallet editor.
- Legacy Habit tag changes retag `records[].type` for `isHabitRecord` rows, while the Vue repository already normalizes stored records by pruning `isHabitRecord` shadow rows and derives habit schedule/list events from `checkins`; Habit base parity should therefore prove stale shadow cleanup, not reintroduce persistent shadow records.
- Legacy Habit deletion writes `deletedItems(collection=habits, reason=manual-delete, name)` plus one `deletedItems(collection=checkins, reason=habit-delete, habitId)` for each related checkin, then removes the habit, checkins, and habit shadow records. The `habitAppData` mirror canonicalizes those checkin tombstones as `habitRecords` with path-prefixed IDs.

## 2026-07-28 Wheel canvas interaction audit

- Legacy `wheel-tool.js` treats the wheel surface as a canvas-backed interaction area, not only a button list: it redraws segment labels, accepts click/drag spin entry points, and records the selected option into history.
- Tag wheels are a two-stage interaction contract. The first spin chooses from enabled public tags; the second spin chooses enabled public library items attached to the locked tag.
- Vue previously had the data-level spin/history/Todo conversion flow, but the visible wheel was a CSS placeholder and tag first-stage result text reused option wording instead of making the candidate-tag stage obvious.
- The bounded Vue fix keeps `lifePlanData` authoritative and only changes local interaction/rendering: no Wheel remote upload or independent sync authority is introduced in this slice.
- Replacement risks left after this slice are batch public-library workflows, independent Wheel remote preview/apply/upload conflict handling, and management-form polish rather than basic canvas interaction.

## 2026-07-28 Wheel public-library batch audit

- Legacy `wheel-tool.js` public-library management keeps a selected-item set across tag filters, reports total selected count plus current-filter count, and provides batch add/remove tag, enable/disable, and delete actions.
- Bulk tag removal has a data-contract guard: a public item must keep at least one tag, so removing the only tag from a selected item is blocked rather than producing an untagged library row.
- Bulk public-item deletion writes `deletedItems(collection=wheelLibraryItems)` tombstones and does not alter already-copied private normal-wheel options.
- Vue already had single public-item CRUD, but replacement parity needed the batch management surface because the old tool is optimized for maintaining many public items and tags.
- The bounded Vue fix keeps all public-library writes under `lifePlanData` and main dirty-state handling; independent Wheel remote preview/apply/upload remains deliberately out of scope.

## 2026-07-27 Diary AI parity

- Legacy diary analysis sends `mode: diaryReview` with a compact `selectedDiary` containing persisted metadata, full Markdown content, `templateId`, and parsed built-in diary fields.
- `ai-service.js` already owns remote request construction, strict JSON parsing, result normalization, local fallback, and relative-date refinement; Vue should reuse it with `lifePlanAiConfig` instead of adding another client.
- AI generation must remain read-only. Section drafts and Todo drafts are editable UI state until separate write commands are explicitly invoked.
- Diary section writeback uses `builtin-diary-daily-review`, preserves unselected sections, confirms before replacing selected non-empty sections, then persists generated heading-based Markdown plus `templateId`.
- Diary AI Todos use `todos-service.js#createTodoFromAiItem`, `sourceType: diary-ai`, the diary ID as `sourceRecordId`, append a source note, and add created IDs to `record.todoIds`; repository commits rebuild `todoAppData`.
- Similar existing Todos are detected through `todos-service.js#findMatchingTodo` and should default to unselected while still allowing deliberate recreation.

## 2026-07-27 New record draft parity

- Legacy does not use a separate `recordDraft` localStorage key. New-record autosave creates or updates a real `lifePlanData.records[]` entity through the normal save path.
- Opening a type initializes suggested dates, current time, diary date-title, and the first built-in structured template while leaving `isRecordDirty` false; closing this untouched initialized modal must not create a record.
- Once a user changes a field, the legacy three-second debounce persists only when input is meaningful: a title, non-template plain content, at least one non-empty structured field, or a temporary Todo.
- Closing a dirty modal cancels the pending debounce and synchronously persists; leaving the page must provide the same flush guarantee in Vue.
- Scoped types are unique for the same range: `日记`, `日计划`, `工作记录`, weekly/monthly/yearly review/plan types, `3年计划`, and `终身愿景` (globally unique). Selecting an existing scope opens that record instead of creating a duplicate.
- The bounded Vue stage will keep new-record templates and idea fields in the create modal; linked/exclusive Todo editing remains available immediately through the shared existing-record editor after first persistence.
