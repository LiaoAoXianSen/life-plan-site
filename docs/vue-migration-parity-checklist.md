# Vue Migration Parity Checklist

This checklist tracks whether `migration/vue-app-v1` can become a replacement candidate for the legacy static app on `master`. Passing build, route smoke tests, or Cloudflare preview deployment is not enough.

## Global Acceptance Gates

- `master` remains deployable as the legacy static app.
- `experiment/vue-preview-poc` and stash `wip-materials-page-v1-before-vue-preview-experiment` remain untouched.
- Vue writes keep `lifePlanData` as the only authoritative data object.
- Compatibility mirrors such as `todoAppData` and `habitAppData` are rebuilt from `lifePlanData`, not treated as primary stores.
- Existing localStorage keys, WebDAV paths, import/export format, snapshots, merge rules, tombstones, and sync dirty state remain compatible with the legacy app.
- Core service behavior remains delegated to existing service files where practical; Vue must not import `app.js`.
- Each closed blocker has regression coverage that checks persisted data shape, not only visible route rendering.

## Page And Module Checklist

| Area | Legacy baseline | Vue baseline | Blocking gaps | Replacement acceptance |
| --- | --- | --- | --- | --- |
| Dashboard | Summaries, today focus, command center, active periods, bounded timeline, and entry points into record preview and domain pages. | Command center, today's Todo/habit ratios, active-goal/week-record summaries, today/floating Todo quick-writes (toggle, 今天做, 执行一次), random Material links, active-period links, and bounded recent timeline links. | No open blocker in the current Dashboard read-only plus Todo quick-write audit; Dashboard habit quick check-in remains optional later polish and replacement remains blocked by other modules. | Dashboard cards reflect the same persisted data, support legacy Todo quick-writes through `lifePlanData` + `todoAppData` mirrors, and navigate to migrated workflows without data loss. |
| Todos | Full CRUD, urgency/focus sorting, sub-todos, sessions, detail links, idea/record relationships, mirror rebuild. | Create/list/filter/toggle/delete plus inline detail and relationship editing, subtask completion, execution sessions, legacy filters/date presets, Dashboard/calendar detail entry points, linked-record navigation, mirror rebuild, protected independent remote flows, and guarded existing-file auto-sync. | No open blocker in the current Todo parity audit; replacement remains blocked by other modules. | Todo writes use `todos-service.js`, preserve tombstones, update linked records, and mirror `todoAppData`. |
| Records | Full editor, auto/manual save, preview, date ranges, templates, structured template fields, linked/exclusive todos, idea fields, list/day/week/month views. | New-record modal with meaningful-input autosave plus persisted editor/preview, manual and 3-second existing-record autosave, close/switch/navigation flush, date ranges, linked/exclusive todos, idea-specific fields, diary AI confirmation writeback, legacy filters/day ordering, list/calendar operation events, six legacy-compatible structured templates, and custom template management. Day view preserves fixed 160px timed event width and hover title. | No open blocker in the current Records parity audit; replacement remains blocked by other modules. | Users can create, preview, edit, delete, template, filter, and link records/todos with legacy-compatible `content`, `templateId`, `todoIds`, idea fields, and tombstones. |
| Ideas | Status colors, tags, next action, conversion to todo, conclusion, filters, search. | Special-state/status/tag/search filters, record-owned detail editing, Records/Todo deep links, editable pre-create Todo draft conversion, and compatible linked-Todo open exist. | No open blocker in the current Ideas AI next-action plus editable draft audit; replacement remains blocked by other modules. | Idea status/tag/next/conclusion/todo link flows round-trip through records and todos without changing field names. |
| Materials | Material CRUD, type colors, source/note/tags, search. | Legacy-compatible create/edit/delete, content-only required field, type/tag normalization, keyword/type/tag filters, descending sort, random review, `material`/`tag` deep links, and tombstones. | No open blocker in the current Materials parity audit; replacement remains blocked by other modules. | Material fields and tombstones remain compatible and searchable. |
| Tags/Search | Cross-module search and tag navigation across records, todos, goals, materials, templates, and wheel public items; tag center with idea/material/wheel scopes. | Grouped module search with scope filtering, exact detail/query navigation, template-management and wheel-library/tag entry points, and combined tag center with summaries, search, scopes, previews, and read-only module jumps. | No open blocker in the current Search/Tags parity audit; replacement remains blocked by other modules. | Search covers legacy modules with matching labels and navigation targets without mutating persisted data. |
| Goals | CRUD/progress/status, detail modal entry points, search/Dashboard deep links, and tombstones. | Detail modal create/edit/delete, `goal=<id>` deep links, Dashboard goal-row restoration, legacy `createDate` and tombstones, and progress/status persistence exist. | No open blocker in the current Goals parity audit; replacement remains blocked by other modules. | Goal writes keep existing fields, avoid Vue-only timestamp churn, and delete with legacy `manual-delete` tombstones. |
| Habits | Full rule editor, edit/delete, notes, undo,补卡, wallet, multi-currency, rewards/penalties, wishes, milestones, diagnostics, dual-write mirror, protected remote workflows. | Basic rule create/edit/delete, advanced reward/penalty/milestone fields, quick check-in, note/backfill check-ins, note edit, undo-latest check-in, reward/penalty ledger reversals, habit archive/restore soft-state, wish create/archive, wallet redeem with negative ledger, read-only diagnostics summary/top issues, habit/check-in tombstones, dirty-state updates, `habitAppData` local mirror, independent remote preview/apply, existing-file protected upload, session-armed first create, and guarded conditional auto-sync. | No open blocker in the current local Habit management/correction/archive/wallet/wishes/diagnostics plus remote preview/apply/upload/create/auto-sync audit; broader penalty settlement UX and deeper diagnostics repair actions remain later Habit risks. | Habit local writes preserve legacy `habits`, `checkins`, `habitPointLedger`, `habitRewards`, tombstones, dirty state, and local-only mirror contracts while keeping `lifePlanData` authoritative. |
| Fitness | Body metrics, exercise library, multi-exercise plans, workout logging, live workout, set timers, plan writeback. | Full-field body metric create/edit/delete, library, multi-exercise plan create/edit, plan-start live workouts, service-backed last-performance suggestions, rest timer controls, explicit finish-time plan writeback, workout history create/edit/delete, manual-delete tombstones, and dirty-state coverage. | No open blocker in the current Fitness parity audit; replacement remains blocked by other modules. | Fitness writes are delegated to `fitness-service.js` and preserve old body metric, plan/workout exercise, set, planned-set, tombstone, and dirty-state contracts. |
| Wheel | Canvas/interaction, normal/tag wheels, public library, batch management, history, JSON/CSV, independent WebDAV sync/conflicts. | CRUD, canvas rendering, click/drag spin entry points, normal and tag two-stage spin, public-library tag filtering and batch tag/enable/delete actions, labeled management forms, history, Todo conversion, JSON/CSV, independent remote preview/apply, protected upload/create, and guarded conditional auto-sync. | No open blocker in the current Wheel parity audit; replacement remains blocked by other modules. | Wheel writes preserve `wheels`, `wheelTags`, `wheelLibraryItems`, `wheelHistory`, Todo conversion links, dirty state, tombstones, and old `wheel-tool.js` interaction expectations. |
| Sync | Main WebDAV pull/push, snapshots, merge, tombstones, ETag conditional writes, conflict retry, module-specific remotes. | Main protected upload/import-export, Todo/Wheel/Habit independent preview/apply/conditional upload/create flows, main auto-sync debounce, periodic visible sync, visibility-resume sync, and Todo/Wheel/Habit guarded conditional auto-sync. | No open blocker in the current main plus Todo/Wheel/Habit module auto-sync audit; replacement remains blocked by other modules. | Sync preserves paths, ETags, snapshots, merge behavior, and refuses unsafe overwrites. |
| AI | Suggestions, diary analysis confirmation writeback, idea next action, todo breakdown, local fallback/remote config. | Chat capture multi-destination writeback, Records diary analysis, Ideas AI next-action confirmed writeback, and Todo breakdown confirmed subtask writeback exist with remote/local generation and editable drafts. | Older today-plan/backlog-triage modes remain later AI depth. | AI actions write back only after confirmation and preserve existing fields. |
| Import/Export | Complete `lifePlanData` backup, import merge with snapshots, not records-only export. | Complete backup/export path exists, import merge creates before/after snapshots, preserves tombstones, refreshes Todo/Habit mirrors, and marks main sync dirty. | No open blocker in the current Import/Export contract audit; replacement remains blocked by other modules. | Import/export round-trips complete data with snapshots, mirror rebuilds, dirty-state updates, and merge semantics intact. |

## Completed Implementation Slices

### Records Editor Slice

Status: verified in `50898e7`


- Add list-page preview/edit support for existing records.
- Save title, type, date range, time, content, and linked todo IDs into `lifePlanData.records`.
- Create an exclusive linked todo from the record editor using `todos-service.js`.
- Rebuild `todoAppData` through the repository commit path.
- Add Playwright coverage asserting both `lifePlanData.records[].todoIds` and `todoAppData.todos` after the editor flow.

Remaining Records scope:

- No open blocker in the current Records audit.

### Records Template Slice

Status: verified locally

- Reuse six stable legacy built-in template IDs and exact heading-based Markdown composition in `records-service.js`.
- Parse existing built-in-template records back into structured editor fields and persist only `content` plus `templateId`; transient `templateFields` are removed on save.
- Save custom templates with the legacy `{ id, name, type, content, todos }` contract and apply cloned Todo IDs with exclusive source records rebound to the target record.
- Confirm custom-template deletion and write a `deletedItems(collection=templates)` tombstone.
- Verify exact persistence, Todo mirror-compatible repository commits, and custom-template deletion in Playwright.
- Verify 1440px and 390px layouts with no document, `.vue-main`, or editor horizontal overflow.

### Idea Detail And Navigation Slice

Status: verified locally

- Edit `ideaStatus`, `ideaTags`, `ideaNextAction`, `ideaTodoId`, and `ideaConclusion` in the shared Records editor and clear those fields when the record changes away from `灵感碎片`.
- Filter Ideas by ordinary status, `unprocessed`, `needsConclusion`, keyword, and partial case-insensitive tag matches through `records-service.js`.
- Deep-link from Ideas to `record=<id>` and from idea previews or cards to `todo=<id>` without duplicating detail state.
- On conversion, replace stale `ideaTodoId` references, fill an empty next action from the Todo title, move `待整理` to `待实践`, and rebuild `todoAppData` through repository commits.
- Verify all five persisted idea fields, stale-link recovery, special filters, deep navigation, and Todo mirror output in Playwright.
- Verify Ideas and Records at 1440px and 390px with long tags/content and no horizontal overflow.

### Existing Record Autosave Slice

Status: verified locally

- Mark the shared Records editor dirty on field changes and persist through the same `recordsStore -> lifePlanRepository` path after the legacy 3-second debounce.
- Flush dirty edits synchronously before closing, switching to another record, or leaving the Records route; manual save cancels the pending timer and uses the same persistence payload.
- Preserve unsaved input when the already-active record is selected again instead of rehydrating stale persisted values over the editor.
- Discard the pending timer when the active record is deleted so deletion cannot be followed by a stale update attempt.
- Verify delayed persistence, immediate close/switch/navigation flush, same-record reselection, and `updatedAt` changes in Playwright.
- Verify dirty/saved status at 1440px and 390px with no document, `.vue-main`, or active-page horizontal overflow.

### Main Auto Sync And Visibility Resume Slice

Status: verified locally

- Persist `lifePlanSyncConfig.autoSync` from the Vue Sync page and start the main auto-sync engine from the app shell.
- Debounce user commits by 20 seconds before running the main both-direction sync when auto-sync and WebDAV URL are enabled.
- Skip interval ticks while the document is hidden, and resume a main both-direction sync on visibility restore.
- Reuse protected ETag upload, merge snapshots, dirty-state updates, and pending follow-up when a commit happens during an active sync.
- Verify debounce upload, visibility resume GET, and autoSync-off idle behavior with Playwright.

### Ideas AI Next-Action Slice

Status: verified locally

- Add AI mode `ideaNext` on the Vue AI page with idea selection, local/remote generation through `ai-service.js`, and editable selected drafts.
- Keep generation read-only until explicit confirm; then create Todos with `sourceType: idea-ai`, link `ideaTodoId` / `todoIds`, set status to `待实践`, replace `ideaNextAction`, and rebuild `todoAppData`.
- Add AI mode `todoBreakdown` that appends selected subtask drafts into an existing Todo note/subTodos only after confirmation.
- Verify no-write on generate, confirmed idea writeback contracts, confirmed breakdown contracts, and mirror rebuild with Playwright.

### AI Chat Capture Multi-Destination Slice

Status: verified locally

- Render editable `chatCapture` drafts for suggested Todos, diary text, work record text, day-plan text, and idea text from `ai-service.js` local/remote normalized output.
- Keep generation read-only: `lifePlanData` and compatibility mirrors remain unchanged until the user confirms one destination.
- Create selected Todo drafts through `todos-service.js` with `sourceType: ai-capture`, editable dates/group/note/subtasks, repository commits, `todoAppData` mirror rebuild, and main sync dirty state.
- Append chat capture text to today's diary or create a `builtin-diary-daily-review` diary when none exists.
- Create work records and idea records through the Records store; idea capture preserves `ideaStatus: 待整理` and `ideaTags: ['AI整理']`.
- Reuse an existing same-day `日计划` scoped record by appending `# AI 对话整理` instead of creating a duplicate plan record.
- Verify no-write generation, per-target confirmed writes, diary template content, day-plan scoped reuse, idea fields, Todo mirror, and dirty sync state with Playwright.

### Ideas Editable Pre-Create Todo Draft Slice

Status: verified locally

- Convert an unlinked idea through `#/todos?ideaDraft=<id>` instead of immediately writing a Todo.
- Prefill the draft from legacy idea text/note helpers, default group `学习`, and optional next-action subtask when it differs from the drafted title text.
- Keep cancel/close read-only with no `lifePlanData` mutation and no `todoAppData` mirror until explicit save.
- On save, create through `todosStore.create`, link with `recordsStore.linkIdeaTodo`, promote `待整理` to `待实践`, preserve existing `ideaNextAction` when present, and rebuild `todoAppData`.
- Verify draft open, cancel no-write, editable save, idea link/status contracts, and mirror rebuild with Playwright.

### Records Diary AI Slice

Status: verified locally

- Reuse `ai-service.js` and `lifePlanAiConfig` for remote requests, strict result normalization, local fallback, and relative-date refinement without adding a parallel AI client.
- Send the legacy `diaryReview` context contract with the selected diary Markdown, template ID, parsed fields, metadata, and editable analysis preference.
- Keep generated sections and Todo suggestions in page-local drafts; no `lifePlanData` mutation occurs before a separate write/create command.
- Confirm before replacing selected non-empty diary fields, preserve unselected template sections, and persist exact heading-based Markdown plus `builtin-diary-daily-review`.
- Create selected Todo drafts through `todos-service.js` with `sourceType: diary-ai`, link IDs through `record.todoIds`, and rebuild `todoAppData` through the repository commit path.
- Default similar existing Todos to unselected, invalidate stale requests when the active record changes, and verify the full remote payload/no-mutation/confirmation/writeback/mirror contract in Playwright.
- Verify editable section and Todo date layouts at 1440px and 390px with no document, `.vue-main`, Records page, or AI-panel horizontal overflow.

### New Record Modal And Draft Slice

Status: verified locally

- Replace the shortcut top-page create form with the legacy grouped type chooser and a dedicated modal editor for all twelve record types.
- Initialize suggested date ranges, current start time, diary date title, and the first built-in structured template without marking the modal dirty or creating data.
- Gate first persistence on meaningful input, then create the real `records[]` entity through `recordsStore -> lifePlanRepository` after the legacy three-second debounce.
- Continue saving the same generated ID, flush dirty input before close, Escape, overlay dismissal, or Records-route unmount, and keep untouched initialized modals out of `lifePlanData`.
- Redirect an already-existing scoped period to the shared editor instead of creating a duplicate diary/plan/review/work record.
- Persist exact built-in-template Markdown and all idea-specific fields; relationship editing remains available through the shared editor immediately after the first save.
- Verify blank close, delayed first save, close and route-leave flush, scoped reuse, template/idea contracts, and 1440px/390px layouts in Playwright and browser screenshots.

### Records Filter And Schedule Slice

Status: verified locally

- Restore the fixed legacy type options, same-day ascending/descending order, idea status/special-state filter, partial case-insensitive idea tag filter, and 7/30/90/all list ranges.
- Match record keywords across title, content, type, start/end dates, normalized idea status/tags, next action, and conclusion; preserve undated records in `全部历史` while bounded ranges stop at today.
- Include Todo execution sessions and one aggregated checked-habit item per habit/date in the Records list, while excluding Todo plan/due rows there.
- Retain the previously accepted Vue calendar superset for Todo plan, due, and execution detail entry points; idea-only filters remove all Todo/habit operation events.
- Prove filter interactions preserve the exact `lifePlanData` string and do not create `todoAppData` or `habitAppData` mirrors.
- Verify all filter controls and mixed event rows at 1440px and 390px with no horizontal overflow.

### Materials Contract Slice

Status: verified locally

- Persist `lifePlanData.materials[]` with the legacy `{ id, type, content, tags, source, note, createdAt, updatedAt }` contract; Vue no longer writes or requires a `title` field.
- Normalize old material rows with string tags, invalid types, missing IDs, and missing timestamps through the repository load path.
- Preserve `id` and `createdAt` on edit, refresh `updatedAt`, and delete with `{ collection: 'materials', id, reason: 'manual-delete' }` tombstones.
- Restore transient keyword/type/tag filtering, descending `createdAt` ordering, and read-only random review over the selected-tag union.
- Support `#/materials?material=<id>` editor restoration and `#/materials?tag=<tag>` filtering, while invalid material queries are cleaned without writing data.
- Route Material search results and Material tag chips to the Materials page; this is a bounded entry-point fix and does not claim full Search/Tags parity.
- Verify exact persistence, tombstone output, read-only filters/random review, route restoration, Search/Tags entry points, and 1440px/390px layouts with Playwright and screenshots.

### Dashboard Read-Only Command Slice

Status: verified locally

- Restore the Dashboard command center with unprocessed ideas, ideas needing conclusion, urgent/high/overdue Todos, random Materials, active goals, Tags, Materials, Goals, Fitness, Ideas, and Todos entry points.
- Show legacy-style summary ratios for today's relevant Todos and due Habits, plus active-goal and current-week record counts.
- Surface today/floating Todo lists as navigation-only rows; no Dashboard checkbox/toggle path mutates Todo data in this slice.
- Surface active period records for weekly/monthly/yearly reviews/plans, `3年计划`, and `终身愿景`, routing to `#/records?record=<id>`.
- Build a bounded recent timeline from records, Todo execution sessions, and checked-habit events while excluding Todo plan/due-only events for Dashboard.
- Verify navigation restoration and exact `lifePlanData` / `todoAppData` immutability in Playwright, plus 1440px/390px screenshots with no horizontal overflow after long-title wrapping fixes.

### Dashboard Todo Quick-Write Slice

Status: verified locally

- Add Dashboard Todo quick-write controls matching legacy: checkbox toggle, floating-pool `今天做`, and `执行一次`.
- `planForToday` writes `planStartDate`/`planEndDate` to today and `updatedAt` through `lifePlan.mutate('plan-todo-for-today')`.
- `quickSession` appends one same-day session with `note: '快捷执行'`, current `HH:mm` start time, empty end time, and refuses a second same-day session with the legacy Chinese error.
- Toggle reuses `todos-service.js.toggleTodoDone`, keeps `lifePlanData` authoritative, marks main sync dirty, and rebuilds local-only `todoAppData` with `remoteUploadEnabled: false` and `authority: 'lifePlanData.todos'`.
- Keep the existing read-only Dashboard contract test green when write buttons are not clicked; add focused quick-write Playwright coverage.
- Full Vue smoke is 75/75.

### Goals Detail Contract Slice

Status: verified locally

- Restore the legacy modal/detail flow for Goals create and edit, including `#/goals?goal=<id>` restoration from Dashboard and direct loads.
- Persist existing Goals through the legacy field contract: `name`, `period`, `target`, `status`, `progress`, and existing `createDate`; Vue does not add `createdAt` or `updatedAt` timestamp churn for old Goal rows.
- Preserve the legacy empty default `period` for new Goals unless the user selects a period, and write `createDate: getTodayStr()` on creation.
- Delete Goals through `sync-service.js.markDeletedItem` with `{ collection: 'goals', reason: 'manual-delete', name }`, then rebuild compatibility mirrors through the repository commit path.
- Verify route restoration, save payload, create defaults, tombstone output, mirror authority, and 1440px/390px modal/list layouts with Playwright and screenshots.

### Habit Local Correction Slice

Status: verified locally

- Add Vue Habit local correction controls for note check-ins, backfilled check-ins, check-in note edits, and undoing the latest check-in for a selected date.
- Preserve legacy write contracts for `lifePlanData.checkins[]`, `habitPointLedger[]` check-in rewards, milestone rewards, `reverse-penalty` entries for same-date miss/break penalties, and `reverse` reward entries when undoing a check-in.
- Delete undone check-ins through `sync-service.js.markDeletedItem` with `{ collection: 'checkins', reason: 'manual-decrease', habitId }`.
- Keep `lifePlanData` authoritative, mark the main sync state dirty through repository mutation, and rebuild `habitAppData` as a local-only mirror with `remoteUploadEnabled: false`.
- Verify quick check-in, backfill, note edit, undo, ledger reversals, tombstones, dirty state, mirror reason/flags, and 1440px/390px Habits layouts with Playwright.

Remaining Habit scope:

- Broader penalty settlement UX and deeper diagnostics repair actions remain later Habit risks.

### Habit Archive Wallet Wishes Diagnostics Slice

Status: verified locally

- Soft-archive and restore habits by toggling `habit.archived` / `updatedAt` only; history checkins and ledger rows stay intact and no habit tombstone is written for archive/restore.
- Create habit wishes (`habitRewards`) with name/cost/currency/stock/note, ensure referenced currencies exist, and archive/restore wishes without tombstones.
- Redeem available wishes by writing a negative `habitPointLedger` entry (`type: 'redeem'`, `amount: -cost`, `rewardId`, `note: 兑换「...」`), incrementing `redeemedCount`, and blocking unavailable/stock-exhausted/insufficient-balance wishes in the UI.
- Rebuild local-only `habitAppData` after every Habit mutation with `remoteUploadEnabled: false` and mutation-specific mirror reasons such as `vue-archive-habit`, `vue-archive-habit-reward`, and `vue-redeem-habit-reward`.
- Surface read-only Habit diagnostics from `habit-service.js.buildLegacyHabitDiagnostics`, mapping legacy issue fields `label`/`hint` (with title/message fallbacks), without writing `lifePlanData` or creating `habitAppData`.
- Verify archive/restore, wish create/archive, wallet redeem, and diagnostics read-only contracts with Playwright; full Vue smoke is 74/74.

### Habit Advanced Reward Fields Slice

Status: verified locally

- Expose the advanced Habit reward/penalty section in the Vue management form, including fixed/random rewards, reward and penalty currencies, break-penalty mode/value/currency, and the legacy milestone reward rows.
- Normalize advanced Habit create/update input in `src/stores/habitsStore.ts` instead of silently resetting old reward fields during a basic edit.
- Preserve `lifePlanData.habits[]` as the authority, ensure referenced `habitCurrencies[]` entries exist, mark the main sync state dirty through repository mutation, and rebuild local-only `habitAppData` with `remoteUploadEnabled: false`.
- Verify advanced field editing, milestone persistence, currency creation, old checkin/record cleanup, tombstones, dirty state, and local mirror output in Playwright.

### Habit Remote Preview/Apply Slice

Status: verified locally

- Add a Vue Sync-page Habit independent sync panel that reuses `lifePlanSyncConfig.webdavUrl` and fixes the path at `/apps/habit-app/data.json`.
- Force restored `habitAppSyncConfig.autoSync` and `remoteUploadEnabled` off; preview/apply never issue PUT and this slice does not create remote Habit files.
- Build the local preview through `LifePlanHabitService.buildHabitAppSnapshotPreview` without writing `localStorage.habitAppData`.
- GET the remote JSON only, normalize/hash it through `sync-service.js` Habit helpers, show local/remote/merged counts and hashes, and surface missing schema arrays as preview risks.
- Keep preview strictly read-only: exactly one GET, no `lifePlanData`, `habitAppData`, or `habitAppSyncState` mutation, and only safe local config flags reset.
- Apply requires a second GET before local persistence; if the cloud hash changes after preview, Vue refreshes the preview, writes `habitAppSyncState.lastConflictAt`, and stops before snapshots or local data writes.
- Apply confirms with the user, creates an application-before snapshot, converts the merged Habit app snapshot back into legacy `habits`, `checkins`, `habitPointLedger`, `habitRewards`, `habitCurrencies`, and legacy tombstones, then rebuilds `habitAppData` as a local-only mirror.
- Apply marks the main `lifePlanSyncState.dirty`, stores Habit sync baseline metadata, preserves non-`life-plan/...` remote IDs, and keeps cloud upload authority disabled.
- Verify in Playwright that preview sends exactly one GET, apply sends exactly two GETs and zero PUTs, race refusal leaves `lifePlanData`/`habitAppData` byte-for-byte unchanged, and successful apply creates the Habit snapshot plus legacy-compatible data.

Remaining Habit remote scope:

- Automatic or resume-triggered Habit sync is covered by the later Habit Conditional Auto Sync slice.

### Habit Protected Existing Upload Slice

Status: verified locally

- Add a `受保护上传` action to the Vue Habit sync panel for existing remote files only; preview remains strictly read-only and first creation remains out of scope.
- Before upload, rebuild the local Habit app snapshot from legacy-authoritative `lifePlanData`, second-GET the remote file, compare the remote hash with the preview baseline, and stop before PUT if the cloud changed.
- Require an exposed remote ETag and explicit confirmation, write with `sync-service.js` `pushJson(..., { ifMatch })`, then immediately GET the remote file again and require the readback hash to match the local snapshot.
- Update `habitAppSyncState` only after upload success or conflict: successful upload sets `dirty: false`, records legacy source hash, remote snapshot hash/ETag, `lastPushAt`, and `lastSyncAt`; conflicts record `lastConflictAt`.
- Keep `habitAppSyncConfig.autoSync` and restored `remoteUploadEnabled` forced off, and do not retry automatically after PUT uncertainty.
- Verify in Playwright that success uses `GET, GET, PUT, GET` with `If-Match`, uploads the local Habit snapshot, resets config flags, and that remote-race refusal uses only `GET, GET` with no local data mutation.

### Habit Session-Armed First Create Slice

Status: verified locally

- Add a current-session `本次会话允许首次创建` arm to the Vue Habit sync panel that only appears after a missing `/apps/habit-app/data.json` preview.
- Keep restored `habitAppSyncConfig.autoSync` and `remoteUploadEnabled` forced off; first creation is an explicit one-shot action, not an authority switch or background sync.
- Before writing, rebuild the local Habit app snapshot from legacy-authoritative `lifePlanData`, second-GET the fixed Habit path, and stop before PUT if another device has created the file.
- Write the missing remote file with `sync-service.js` `pushJson(..., { ifNoneMatch: '*' })`, immediately GET it back, and require the readback Habit hash to match the local snapshot before marking sync state clean.
- Report HTTP 412 or uncertain PUT/readback failures without automatic retry; reset the session arm after every attempt.
- Verify in Playwright that first creation is disabled until armed, success uses `GET, GET, PUT, GET` with `If-None-Match: *`, uploads the local Habit snapshot, records clean sync metadata, resets config flags, and that final-recheck races use only `GET, GET` with no local data mutation.

### Habit Conditional Auto Sync Slice

Status: verified locally

- Add an explicit opt-in Habit auto-sync engine that reuses `lifePlanSyncConfig.webdavUrl` and keeps the independent path fixed at `/apps/habit-app/data.json`.
- Sanitize stale `habitAppSyncConfig` on app startup: unsafe paths and restored upload authorization are reset, and old `autoSync: true` values do not silently enable the new engine without the Vue confirmation marker.
- Debounce Habit-changing user commits by 20 seconds, run visible periodic/visibility-resume checks, and skip entirely when the Habit module auto-sync switch is off.
- Keep missing remote files create-only-manual: automatic sync may GET a 404, but it never sends `If-None-Match` or creates the Habit file in the background.
- For existing remotes, rebuild the Habit app snapshot from authoritative `lifePlanData`, apply remote Habit snapshots back into legacy `habits`, `checkins`, `habitPointLedger`, `habitRewards`, and `habitCurrencies`, mark main `lifePlanSyncState.dirty` when authority changes, and use `If-Match` plus GET hash verification before clearing `habitAppSyncState.dirty`.
- Verify stale-config idle behavior, dirty local conditional upload, remote visibility-resume pull/main dirty propagation, and missing-remote no-create behavior with Playwright.

### Search And Tags Index Slice

Status: verified locally

- Rebuild global Search as a grouped legacy-style index over Records, Todos, Goals, Materials, custom Templates, and Wheel public library items.
- Match keywords against module, title, subtitle, body, meta, and tags; add module scope filtering without creating new storage keys.
- Route search results to precise migrated entry points: `record=<id>`, `todo=<id>`, `goal=<id>`, `material=<id>`, `template=<id>` manager focus, and `library=<id>` Wheel public item focus.
- Restore the combined tag center with all/idea/material/wheel summaries, keyword and scope filters, per-tag preview snippets, and separate read-only jumps to `#/ideas?tag=`, `#/materials?tag=`, and `#/wheel?tag=`.
- Add supporting route restoration for Ideas tag filtering, Records template-manager focus, and Wheel tag/library form focus without writing data.
- Verify Search/Tags navigation, module counts, Tags material regression compatibility, exact `lifePlanData` immutability, no compatibility mirror creation, and 1440px/390px long-text layouts with Playwright and screenshots.

### Import Export Contract Slice

Status: verified locally

- Keep manual export as a complete `lifePlanData` backup and create the legacy `手动导出备份` local snapshot before downloading.
- Keep manual import merge-based: create `导入前自动备份`, merge through `sync-service.js.mergeCloudData`, then create `导入合并结果`.
- Preserve `deletedItems` tombstones so stale imported rows do not revive locally deleted records.
- Treat manual imports as local/user data changes: update `lifePlanSyncState.lastLocalHash` and set `dirty: true` so `/life-plan.json` propagation is not skipped.
- Rebuild both compatibility mirrors from authoritative `lifePlanData`: `todoAppData` and `habitAppData` remain local mirrors with remote upload disabled.
- Verify the real Sync page file-input/download flow in Playwright, including snapshots, tombstones, Todo/Habit mirror contents, dirty state, and backup filename.

### Fitness Multi-Exercise Plan Slice

Status: verified locally

- Create and edit Fitness plans with multiple exercises and per-set weight/reps rows while preserving `fitnessPlans[].exercises` plus mirrored `days[0].exercises`.
- Start a live workout from the whole plan so `fitnessWorkouts[]` keeps `planId`, `planName`, multiple exercises, set rows, and `plannedSets`.
- Finish plan workouts without silently changing the source plan; only an explicit checked writeback updates the plan prescription through `fitness-service.js#updatePlanFromWorkout`.
- Delete Fitness entities with legacy `manual-delete` tombstones rather than Vue-specific tombstone reasons.
- Verify plan persistence, planned-set preservation, no-writeback behavior, explicit writeback behavior, dirty sync state, plan deletion tombstone output, and 1440px/390px Fitness layouts with Playwright.

### Fitness History Editor Slice

Status: verified locally

- Add a Vue workout-history create/edit form for completed, planned, or skipped training logs while keeping `lifePlanData.fitnessWorkouts` authoritative.
- Allow history logs to be created from an existing plan so `planId`, `planName`, exercise rows, and `plannedSets` persist like legacy workouts.
- Preserve multi-exercise, multi-set `weight`, `reps`, `done`, `durationMin`, `notes`, and timestamp-normalized workout fields through `fitness-service.js#upsertFitnessWorkout`.
- Keep Fitness deletes on legacy `manual-delete` tombstones and avoid introducing any `fitnessAppData` mirror.
- Verify create, edit-in-place, dirty sync state, no mirror creation, deletion tombstone output, and 1440px/390px create/edit layouts with Playwright.

### Fitness Body Metrics Full Field Slice

Status: verified locally

- Drive the Vue body metric form from `fitness-service.js` `METRIC_FIELDS` and `CONDITION_OPTIONS` instead of a partial hard-coded weight/body-fat/waist subset.
- Support create and edit for legacy metric fields: weight, body fat, chest, waist, hips, arm, thigh, calf, shoulder, height, condition, date, and note.
- Render recent metrics with wrapping field chips so legacy measurements remain inspectable without adding a `fitnessAppData` mirror.
- Preserve `lifePlanData.bodyMetrics` authority, `manual-delete` body metric tombstones, dirty sync state, and the shared `fitness-service.js#upsertBodyMetric` fallback behavior for existing records.
- Verify full-field create/edit/delete, numeric normalization, dirty state, no mirror creation, tombstone output, and 1440px/390px layouts with Playwright.

Remaining Fitness scope:

- No open blocker in the current Fitness parity audit.

### Fitness Live Workout Assist Slice

Status: verified locally

- Show service-backed last-performance hints during Vue live workouts via `fitness-service.js#findLastExercisePerformance`.
- Add a per-set `套用建议` action that writes suggested weight/reps into the active in-progress workout without marking the set complete.
- Start a Vue rest timer after completing a set, using the `restSec` returned by `fitness-service.js#completeWorkoutSet` and the current exercise/library rest setting.
- Add timer controls for +30s, -30s, and skip while keeping timer state page-local and out of `lifePlanData`.
- Preserve active workout persistence, dirty sync state, explicit plan writeback behavior, and no `fitnessAppData` mirror.
- Verify suggestion text, suggestion apply, active workout set persistence, rest timer display/controls, dirty state, and 1440px/390px layouts with Playwright.

Remaining Fitness scope:

- No open blocker in the current Fitness parity audit.

### Wheel Canvas Interaction Slice

Status: verified locally

- Replace the placeholder CSS disc with a real canvas-rendered wheel that redraws from the current option set and shows weighted segment labels.
- Keep the wheel itself as an interaction target: click/keyboard starts a spin, and pointer drag rotates the wheel before committing a spin.
- For tag wheels, render the first stage from enabled public tags, then lock the selected tag and render the second-stage public library options.
- Preserve write contracts for `wheelHistory`, tag-mode `tagId` / `tagName`, Todo conversion source links, `todoAppData` mirror rebuilds, and `lifePlanSyncState.dirty`.
- Verify canvas pixels, click, drag, tag two-stage result, history ordering, Todo conversion, dirty state, and 1440px/390px layouts with Playwright screenshots.

Remaining Wheel scope:

- No open blocker in the current Wheel parity audit.

### Wheel Public Library Batch Slice

Status: verified locally

- Restore the legacy public-library management surface for tag filtering, selected-visible counts, and multi-item selection.
- Add batch operations for public library items: add tags, remove tags, enable, disable, and delete.
- Preserve the legacy guard that a public item must keep at least one tag when removing tags in bulk.
- Delete selected public items with `deletedItems(collection=wheelLibraryItems)` tombstones while leaving already-copied private wheel options untouched.
- Avoid dirtying main sync state for no-op batch actions; real changes still flow through `lifePlan.mutate`.
- Verify selection/filter behavior, tag add/remove, only-tag guard, enable/disable, delete tombstones, dirty state, and 1440px/390px layouts with Playwright.

Remaining Wheel scope:

- No open blocker in the current Wheel parity audit.

### Wheel Remote Preview Apply Slice

Status: verified locally

- Reuse the unified main sync endpoint while fixing the Wheel independent path at `/apps/wheel-app/data.json`.
- Force restored Wheel independent sync config to `autoSync: false` and `remoteUploadEnabled: false`; this slice never issues PUT requests or creates the remote file.
- Keep preview GET-only, validate required Wheel arrays, show local/remote/merged hashes and collection counts, and preserve `lifePlanData` unchanged during preview.
- Require a second GET before applying the merge; if the cloud hash changes after preview, refresh the preview, record `lastConflictAt`, and stop before persistence or snapshots.
- Apply the tombstone-aware `sync-service.js.mergeWheelSnapshots` result into `lifePlanData`, create an application-before snapshot, update `lifePlanWheelSyncState`, and mark the main `lifePlanSyncState` dirty.
- Verify GET-only preview, fixed path/config reset, merge persistence, Wheel tombstones, dirty states, snapshot creation, and cloud-race refusal in Playwright.
- Verify 1440px and 390px Sync-page layouts with the Wheel sync panel rendered and no document, `.vue-main`, page, or panel horizontal overflow.

Remaining Wheel scope:

- No open blocker in the current Wheel parity audit.

### Wheel Protected Upload Create Slice

Status: verified locally

- Extend the Wheel independent sync panel with protected existing-file upload and session-armed first creation while keeping restored `remoteUploadEnabled` forced off.
- Existing remote upload re-GETs `/apps/wheel-app/data.json`, refuses to PUT if the cloud hash changed since preview, requires an ETag, writes with `If-Match`, and then GET-verifies the written Wheel hash.
- First remote creation is available only after a missing-file preview and a current-session checkbox; it rechecks the path, writes with `If-None-Match: *`, and then GET-verifies the written hash.
- Neither protected write path changes `lifePlanData`; successful uploads clear `lifePlanWheelSyncState.dirty` and store the verified remote ETag, while uncertain PUT outcomes are not retried automatically.
- Verify existing upload, remote-race refusal, first creation, fixed path/config reset, conditional headers, readback verification, and upload-authority reset in Playwright.
- Verify ready and missing states at 1440px and 390px with no document, `.vue-main`, page, or Wheel panel horizontal overflow.

Remaining Wheel scope:

- No open blocker in the current Wheel parity audit.

### Wheel Conditional Auto Sync Slice

Status: verified locally

- Add a Vue Wheel auto-sync engine that starts from the app shell and uses the existing `sync-service.js` Wheel snapshot, merge, hash, and conditional PUT helpers.
- Require explicit Vue opt-in through `conditionalAutoSyncEnabled`; unsafe restored config values such as custom remote paths or `remoteUploadEnabled: true` are normalized away.
- Keep the remote path fixed at `/apps/wheel-app/data.json` and reuse `lifePlanSyncConfig.webdavUrl`; no second endpoint is introduced.
- Debounce Wheel data changes for 20 seconds, run a 5-minute visible interval, and resume sync on visibility restore.
- Auto-sync only handles existing remote files: missing remote files are GET-only skips and never trigger background `If-None-Match` creation.
- Existing-file upload requires a known baseline plus ETag, writes with `If-Match`, and immediately GET-verifies the uploaded Wheel hash.
- Remote-only updates apply into `lifePlanData` through the repository, mark main sync dirty for later `/life-plan.json` propagation, and keep `remoteUploadEnabled` false.
- Verify disabled idle behavior, unsafe config sanitization, dirty upload, missing-file no-create, visibility pull, fixed path, state updates, and main dirty preservation with Playwright.

### Wheel Management Polish Slice

Status: verified locally

- Add a compact management summary for wheel, tag, public item, and history counts without adding persisted fields.
- Replace compressed option, tag, and public-library item editors with labeled controls for name, color, weight, and enabled state.
- Keep edit buttons focused on filling forms only; entering edit mode does not mutate `lifePlanData` or rebuild compatibility mirrors.
- Strengthen row wrapping, action alignment, management grid sizing, and mobile form stacking for long wheel/tag/library names.
- Verify management summary text, edit-form values, read-only edit focus, and 1440px/390px layouts with no document, `.vue-main`, `#page-wheel`, management grid, summary, or public library overflow.

Remaining Wheel scope:

- No open blocker in the current Wheel parity audit.

### Sync Protected Main Upload Slice

Status: verified locally

- Keep the main remote path as `/life-plan.json` and the state key as `lifePlanSyncState`.
- Before manual upload, read the current remote ETag through `sync-service.js` `pullJson`.
- Upload with `sync-service.js` `pushJson(..., { ifMatch })`.
- On HTTP 412, fetch the latest remote payload, create conflict merge snapshots, merge through `mergeCloudData`, persist the merged `lifePlanData`, then retry once with the new ETag.
- Preserve tombstones so remote stale records do not revive local deletions.
- Add Playwright coverage asserting GET/PUT sequence, `If-Match` headers, merged local/remote records, retained tombstones, conflict snapshots, and `lifePlanSyncState.lastRemoteEtag`.

Remaining Sync scope:

- Replacement-candidate end-to-end sync acceptance across main data and the independent Todo/Wheel/Habit remotes.
- Vue artifact publication packaging that does not use `scripts/package-clean.ps1`.

### Todo Detail Contract Slice

Status: verified locally

- Select a Todo from the overview and edit title, note, plan range, due date, urgency, group, and subtasks in an inline detail panel.
- Toggle subtasks in view mode and reuse `todos-service.js` completion rules so all-complete and reopened states preserve legacy `done` / `completedAt` behavior.
- Add and remove execution sessions while preserving legacy session fields, time validation, and one-session-per-day behavior.
- Show records and ideas that reference the Todo through `todoIds` or `ideaTodoId`.
- Delete through the existing tombstone service, remove record/idea references, update touched record timestamps, and rebuild `todoAppData` from `lifePlanData`.
- Add Playwright coverage for the complete persisted lifecycle: detail fields, subtasks, sessions, mirror contents, Todo tombstone, and relationship cleanup.
- Verify desktop and mobile layouts with old-format fixture data; the page remains within the viewport at 1440px and 390px widths.

Remaining Todo scope:

- No open blocker in the current Todo parity audit. Reopen this section only when a concrete legacy/data-contract difference is found.

### Todo Filters And Record Deep Links

Status: verified locally

- Reuse `todos-service.js.isTodoInDateRange` for legacy-compatible start/end filtering, alongside status, urgency, group, exclusive/shared, and text filters.
- Show the legacy `isExclusive` distinction as a dedicated table column instead of keeping it as hidden filter-only state.
- Navigate linked Todo records through `#/records?record=<id>` and restore the exact record editor from that query on direct load or refresh.
- Remove the `record` query when the editor closes, preserving predictable back/refresh behavior.
- Keep filtering and navigation read-only: regression coverage asserts the exact `lifePlanData` storage string remains unchanged and no `todoAppData` mirror is created.
- Verify the seven-control filter surface at 390px and 1440px widths, including visible start/end date labels and zero page-level horizontal overflow.

### Todo Cross-Entry And Schedule Slice

Status: verified locally

- Restore an exact Todo detail from `#/todos?todo=<id>` and remove the query when the detail closes or the Todo is deleted.
- Open the same detail route from Dashboard today/floating lists and from Todo plan, due, and execution items in record calendar views.
- Render one all-day plan item for every date in a Todo plan range, one all-day due item on its due date, and timed/all-day execution items from sessions.
- Provide legacy today, tomorrow, this-week, next-week, and no-date presets while keeping their values draft-only until the user saves.
- Keep route and preset-only actions read-only: Playwright asserts the exact `lifePlanData` string remains unchanged and no `todoAppData` mirror is created.
- Verify detail editing and day-calendar layouts at 1440px and 390px widths with zero page-level horizontal overflow.

### Todo Record Relationship Editing Slice

Status: verified locally

- Add ordinary record relationships from Todo detail by updating the record-owned `todoIds` field.
- Remove ordinary and idea-origin relationships by clearing the selected Todo from `record.todoIds` and `record.ideaTodoId` together.
- Preserve exclusive-source invariants by showing the source record without an unlink command when `isExclusive` and `sourceRecordId` identify it.
- Persist touched record timestamps and rebuild `todoAppData` through the existing `lifePlan.mutate` repository path.
- Add Playwright coverage for added/removed record fields, timestamps, mirror authority, and the protected exclusive-source UI.
- Verify the relationship controls at 1440px and 390px widths, including the desktop internal scroll container and zero horizontal overflow.

### Todo Independent Sync Slice

Status: verified locally

- Reuse `lifePlanSyncConfig.webdavUrl` and keep the independent path fixed at `/apps/todo-app/data.json`; no second endpoint is stored.
- Force `todoAppSyncConfig.autoSync` and restored upload authorization off, with first creation unlocked only by a current-session checkbox.
- Keep preview GET-only for authoritative data, then require a second GET before applying the tombstone-aware `todos-service.js` merge to `lifePlanData`.
- Create an application-before snapshot, rebuild `todoAppData`, persist `todoAppSyncState`, and mark the main `lifePlanSyncState` dirty after an independent Todo merge changes authority.
- Upload an existing file only against an unchanged preview baseline with `If-Match`; create a missing file with `If-None-Match: *`; always GET-verify the written Todo hash and never auto-retry an uncertain PUT.
- Add Playwright coverage for GET-only preview, merge persistence, snapshots, both conditional headers, post-write verification, restored authorization reset, and pre-PUT refusal when the remote changes.
- Pass the complete 14-test Vue suite and verify the comparison/action surface at 1440px and 390px with zero document or main-container horizontal overflow.

### Todo Independent Auto Sync Slice

Status: verified locally

- Add an explicit opt-in Todo auto-sync engine that reuses `lifePlanSyncConfig.webdavUrl` and still hard-codes `/apps/todo-app/data.json`.
- Sanitize stale `todoAppSyncConfig` on app startup: unsafe paths and restored upload authorization are reset, and old `autoSync: true` values do not silently enable the new engine without the Vue confirmation marker.
- Debounce Todo-changing user commits by 20 seconds, run visible periodic/visibility-resume checks, and skip entirely when the Todo module auto-sync switch is off.
- Keep missing remote files create-only-manual: automatic sync may GET a 404, but it never sends `If-None-Match` or creates the Todo file in the background.
- Match Habit/Wheel's guarded first-difference posture: the first existing remote mismatch records a baseline and requires manual preview before automatic merge/upload.
- For existing remotes, rebuild and verify the local `todoAppData` mirror from authoritative `lifePlanData`, merge with `todos-service.js`, apply remote changes back to `lifePlanData`, mark main `lifePlanSyncState.dirty` when authority changes, and use `If-Match` plus GET hash verification before clearing `todoAppSyncState.dirty`.
- Verify stale-config idle behavior, missing-baseline refusal, dirty local conditional upload, remote merge/main dirty propagation, and missing-remote no-create behavior with Playwright.
