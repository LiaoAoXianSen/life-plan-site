# Vue migration preview deployment

The Vite/Vue work is isolated on `migration/vue-app-v1`. The active project scope is to improve and verify the Vue application, its tests, and its documentation. Switching the live deployment from the legacy app to Vue is intentionally out of scope and is not tracked as remaining work.

The deployment notes below are retained only as reference for local or isolated preview verification; they are not an instruction to change the existing live deployment.

## Local verification

Use the project-supported Node 20 or Node 22 runtime (current local verification uses managed Node 22.22.2):

```powershell
npm ci
npm run build
npm test
```

The build output is `dist/`. The project uses Vue Router hash history, so
Cloudflare does not need a SPA fallback rule for route refreshes.

### Vue dist packaging

Do **not** use `scripts/package-clean.ps1` for Vue artifacts. That script packs
the legacy static runtime only.

```powershell
npm run package:vue
# or
.\scripts\package-vue-dist.ps1
# skip rebuild when dist/ is already fresh:
.\scripts\package-vue-dist.ps1 -SkipBuild
```

This writes `life-plan-site-vue-dist-YYYYMMDD-HHMMSS.zip` from `dist/` and keeps
the newest 5 Vue dist packages by default.

## Optional isolated preview reference

If an isolated preview is needed for testing, use a separate Pages project connected to the same GitHub repository and limited to `migration/vue-app-v1`. This is optional reference material; changing the live deployment is outside the active work scope.

| Setting | Value |
| --- | --- |
| Framework preset | Vite (or Vue if Vite is unavailable) |
| Production branch | `migration/vue-app-v1` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | blank / repository root |
| Environment variable | `NODE_VERSION=22` (Node 20 is also supported) |

The application has `base: './'` in `vite.config.mts`, which makes generated
assets work from the Pages project root. Use the preview URL for data testing;
export a user backup first because browser `localStorage` is origin-scoped.

## Data and service boundaries

- Authority remains `localStorage['lifePlanData']`; `todoAppData` and
  `habitAppData` are rebuilt compatibility mirrors.
- Main-data import remains merge-based, makes before/after snapshots, preserves
  tombstones, rebuilds Todo/Habit compatibility mirrors, and marks main sync
  dirty for later `/life-plan.json` propagation.
- Main WebDAV keeps `/life-plan.json`; wheel/habit/todo legacy remote paths are
  unchanged in the static production application.
- The root legacy service files are loaded as side-effect services by
  `src/services/legacyServices.ts`. `app.js` is never imported into Vue.

## Rollback

No production rollback is required while the preview uses its own Pages
project. To abandon a preview deployment, change or delete only that separate
Pages project; the existing `master` deployment continues serving the static
application.

To return the local checkout to the static app without destructive commands:

```powershell
git switch master
```

To continue the migration later:

```powershell
git switch migration/vue-app-v1
```

If a Vue-side data action must be reverted, use the existing snapshot recovery
flow. Wheel JSON restore and import operations make snapshots before applying
changes. Keep a manually exported data file before testing complex data flows.

## Replacement-candidate status

`migration/vue-app-v1` is an operational **replacement candidate** for daily
workflows covered by the parity checklist. The current full Vue smoke gate is
217/217, with production build and Vue dist packaging verified on 2026-08-02.
The whole active Vue project is **100% complete for the documented scope**; this
is a whole-project status rather than a per-slice score. The documented
specialist follow-ups are closed, route pages load through lazy chunks, and the
explicit ESM Vite config removes the prior CJS warning. Wheel AI suggestions
cover local/remote/fallback flows, while Habit diagnostics applies only
deterministic safe repairs after confirmation and a local snapshot. Live
deployment switching is not part of this project scope.

UI/IA shell parity has been tightened toward the legacy product surfaces:
Habit center tabs/KPI with compact today actions, browse-first Todos filters,
Ideas header create + filter-first layout, Tags filter-above-KPI order, sidebar
primary `+ 新建记录`, Fitness overview KPI hero, and Wheel focus-stage plus
management drawer.

The Vue branch has operational Dashboard, Todos, Records, Materials, Libraries,
Search, Goals, Habits, Fitness, Wheel, AI and main Sync workflows. The
Dashboard now covers the command center, active-period links, bounded recent
timeline, Todo quick-writes (`今天做`, `执行一次`, checkbox toggle), and today
habit quick check-in/undo;
Goals now covers detail deep links and legacy tombstones; Search/Tags now
restore grouped module indexes and read-only tag entry points across migrated
modules; Import/Export now covers snapshots, tombstone-aware merge, dirty-state
updates, and Todo/Habit mirror rebuilds; Habits now covers local note check-ins,
backfills, note edits, undo-latest check-in, advanced reward/penalty/milestone
editing, reward/penalty ledger reversals, archive/restore, wish create/archive,
wallet redemption, diagnostics with confirmed safe repair and pre-repair snapshots,
settle-through-yesterday penalties,
tombstones, dirty-state updates, local-only mirror rebuilding, independent
remote preview/apply, protected upload/create, and guarded conditional
auto-sync; Fitness now covers full-field body metric editing, multi-exercise
plan editing, explicit plan writeback, workout history create/edit, legacy-style
four-column live sets, last-performance suggestions, and rest timers with
legacy `-15s` / `+15s` / skip controls plus automatic expiry cleanup; Wheel now covers canvas
interaction, public-library batch management and local/remote AI tag suggestions,
independent remote preview/apply, protected upload/create, guarded conditional
auto-sync, and final management-form polish; Todo independent sync now covers guarded existing-file
auto-sync without background first-create; AI now covers multi-destination chat
capture writeback, today-plan and backlog-triage confirmed Todo writeback, plus
diary, idea-next, and Todo-breakdown confirmation flows.
