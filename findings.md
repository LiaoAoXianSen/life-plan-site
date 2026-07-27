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
