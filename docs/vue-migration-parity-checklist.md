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
| Dashboard | Summaries, today focus, recent records/todos/ideas, entry points into record preview and domain pages. | Basic dashboard overview plus exact Todo detail links from today and floating lists. | Needs parity audit of record preview links and domain summary edge cases. | Dashboard cards reflect the same persisted data and navigate to migrated workflows without data loss. |
| Todos | Full CRUD, urgency/focus sorting, sub-todos, sessions, detail links, idea/record relationships, mirror rebuild. | Create/list/filter/toggle/delete plus inline detail editing, subtask completion, execution sessions, legacy filters/date presets, Dashboard/calendar detail entry points, linked-record deep navigation, and `todoAppData` mirror rebuild. | Relationship editing from Todo detail and Todo independent remote flows remain incomplete. | Todo writes use `todos-service.js`, preserve tombstones, update linked records, and mirror `todoAppData`. |
| Records | Full editor, auto/manual save, preview, date ranges, templates, structured template fields, linked/exclusive todos, idea fields, list/day/week/month views. | List/calendar views plus basic create/delete. Day view preserves fixed 160px timed event width and hover title. | Full editor, preview, templates, linked todos, detail interactions, and legacy filters are incomplete. | Users can create, preview, edit, delete, and link records/todos with legacy-compatible `todoIds`, tombstones, and snapshots where applicable. |
| Ideas | Status colors, tags, next action, conversion to todo, conclusion, filters, search. | Status filtering, colors, tags/search, and basic todo conversion exist. | Detail editing and old AI/next-action flows need parity audit. | Idea status/tag/next/conclusion/todo link flows round-trip through records and todos without changing field names. |
| Materials | Material CRUD, type colors, source/note/tags, search. | Basic material CRUD/search exists. | Edit/detail parity and advanced filters need audit. | Material fields and tombstones remain compatible and searchable. |
| Tags/Search | Cross-module search and tag navigation. | Basic global search and tag center exist. | Needs full index parity including templates and wheel items. | Search covers legacy modules with matching labels and navigation targets. |
| Goals | CRUD/progress/status and tombstones. | Basic CRUD/progress exists. | Needs detail parity audit. | Goal writes keep existing fields and delete tombstones. |
| Habits | Full rule editor, archive/delete, notes, undo,补卡, wallet, multi-currency, rewards/penalties, wishes, milestones, diagnostics, dual-write mirror, protected remote workflows. | Basic create and quick check-in with `habitAppData` local mirror. | Most advanced workflows remain blockers. | Habit workflows produce the same `habits`, `checkins`, `habitPointLedger`, currency, milestone, mirror, and conflict data as legacy. |
| Fitness | Body metrics, exercise library, multi-exercise plans, workout logging, live workout, set timers, plan writeback. | Metrics, library, single-exercise plan, live workout basics, history. | Multi-exercise plan editing, timer UX, complete history editing, plan writeback. | Fitness writes are delegated to `fitness-service.js` and support old multi-exercise workflows. |
| Wheel | Canvas/interaction, normal/tag wheels, public library, batch management, history, JSON/CSV, independent WebDAV sync/conflicts. | CRUD, tag two-stage spin, history, todo conversion, JSON/CSV. | Canvas parity, batch public-item flows, independent sync/conflict handling. | Wheel collections and independent sync path remain compatible with old `wheel-tool.js` behavior. |
| Sync | Main WebDAV pull/push, snapshots, merge, tombstones, ETag conditional writes, conflict retry, module-specific remotes. | Basic main sync and import/export exist. | Auto sync, conditional writes/conflict retry, habit/wheel/todo independent flows. | Sync preserves paths, ETags, snapshots, merge behavior, and refuses unsafe overwrites. |
| AI | Suggestions, diary analysis confirmation writeback, idea next action, todo breakdown, local fallback/remote config. | Basic advice and remote/local request path. | Old modes and confirmation writeback are incomplete. | AI actions write back only after confirmation and preserve existing fields. |
| Import/Export | Complete `lifePlanData` backup, import merge with snapshots, not records-only export. | Complete backup/export path exists. | Needs broader contract tests with mirrors/tombstones. | Import/export round-trips complete data with snapshots and merge semantics intact. |

## Completed Implementation Slices

### Records Editor Slice

Status: verified in `50898e7`


- Add list-page preview/edit support for existing records.
- Save title, type, date range, time, content, and linked todo IDs into `lifePlanData.records`.
- Create an exclusive linked todo from the record editor using `todos-service.js`.
- Rebuild `todoAppData` through the repository commit path.
- Add Playwright coverage asserting both `lifePlanData.records[].todoIds` and `todoAppData.todos` after the editor flow.

Remaining Records scope:

- Built-in structured templates and user template management.
- AI diary analysis writeback.
- Full legacy modal/autosave behavior.

### Sync Protected Main Upload Slice

Status: verified locally

- Keep the main remote path as `/life-plan.json` and the state key as `lifePlanSyncState`.
- Before manual upload, read the current remote ETag through `sync-service.js` `pullJson`.
- Upload with `sync-service.js` `pushJson(..., { ifMatch })`.
- On HTTP 412, fetch the latest remote payload, create conflict merge snapshots, merge through `mergeCloudData`, persist the merged `lifePlanData`, then retry once with the new ETag.
- Preserve tombstones so remote stale records do not revive local deletions.
- Add Playwright coverage asserting GET/PUT sequence, `If-Match` headers, merged local/remote records, retained tombstones, conflict snapshots, and `lifePlanSyncState.lastRemoteEtag`.

Remaining Sync scope:

- Automatic sync and visibility-resume sync.
- Independent todo/habit/wheel remote preview/apply/upload flows.
- WebDAV verification readback for independent app mirrors.

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

- Relationship creation/removal from the Todo detail.
- Independent Todo remote preview/apply/upload diagnostics and conflict handling.

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
