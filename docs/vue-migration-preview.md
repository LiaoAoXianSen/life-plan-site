# Vue migration preview deployment

The Vite/Vue migration is isolated on `migration/vue-app-v1`. Do not point the
production Pages project at this branch until the migration has received a
separate release decision. `master` remains the static production application
and its deployment configuration must not change.

## Local verification

Use Node 20 (the pinned toolchain works with the local 20.13.1 runtime):

```powershell
npm ci
npm run build
npm test
```

The build output is `dist/`. The project uses Vue Router hash history, so
Cloudflare does not need a SPA fallback rule for route refreshes.

## Separate Cloudflare Pages preview

Create a new Pages project connected to the same GitHub repository, limited to
the `migration/vue-app-v1` branch. Do **not** edit the existing production
Pages project.

| Setting | Value |
| --- | --- |
| Framework preset | Vite (or Vue if Vite is unavailable) |
| Production branch | `migration/vue-app-v1` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | blank / repository root |
| Environment variable | `NODE_VERSION=20` |

The application has `base: './'` in `vite.config.ts`, which makes generated
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

## Advanced legacy controls retained on master

The Vue branch has operational Dashboard, Todos, Records, Materials, Libraries,
Search, Goals, basic Habits, Fitness, Wheel, AI and main Sync workflows. The
Dashboard now covers the read-only command center, active-period links, and
bounded recent timeline; Goals now covers detail deep links and legacy
tombstones; Search/Tags now restore grouped module indexes and read-only tag
entry points across migrated modules; Import/Export now covers snapshots,
tombstone-aware merge, dirty-state updates, and Todo/Habit mirror rebuilds;
Habits now covers local note check-ins, backfills, note edits, undo-latest
check-in, reward/penalty ledger reversals, tombstones, dirty-state updates,
local-only mirror rebuilding, and independent remote preview/apply without cloud upload; Fitness now covers full-field body metric
editing, multi-exercise plan editing, explicit plan writeback, and workout
history create/edit plus live rest timers and last-performance suggestions;
Wheel now covers canvas interaction, public-library batch management,
independent remote preview/apply, protected upload/create, and final
management-form polish without automatic sync.
Replacement remains blocked until the remaining module audits and write-heavy
specialist flows are closed. The following specialist controls still live in the
proven static app and should be migrated only as separately tested follow-up
releases: habit full rule editing, wallet/reward administration, diagnostics
depth, protected upload/create remote flows; and non-diary AI writeback modes. They are
not replaced by incompatible shortcuts.
