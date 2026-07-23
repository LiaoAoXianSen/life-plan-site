# Findings

## 2026-07-23

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
