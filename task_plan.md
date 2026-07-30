# Task Plan

## Goal
Continue the formal Vue migration on `migration/vue-app-v1` until the Vue app is a credible replacement candidate for the legacy static app on `master`, with explicit feature-parity acceptance criteria and persisted-data contract coverage.

## Current Goal (2026-07-27, Vue replacement candidate)

Preserve `master`, `experiment/vue-preview-poc`, and the protected materials-page stash while closing one bounded parity blocker at a time. Each completed slice must preserve `lifePlanData` authority, compatibility mirrors, tombstones, snapshots, and existing remote paths; it must pass focused contract tests plus the applicable build/test/check gates before commit.

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
45. Status: complete - Add post-apply habit sync guidance so the diagnostics UI clearly tells the user whether the next step is cloud sync or no action.
46. Status: complete - Establish the Vue migration branch, smoke suite, deployment/rollback guide, and module-by-module parity checklist.
47. Status: complete - Migrate and verify initial dashboard, todos, records, libraries, search, goals, habits, fitness, wheel, AI, import/export, and protected main-sync slices without importing `app.js`.
48. Status: complete - Add the first records editor parity slice with persisted record/todo relationship contract coverage.
49. Status: complete - Add protected main-sync upload with ETag conflict handling, snapshots, tombstone preservation, and persisted-state contract coverage.
50. Status: complete - Audit and implement the next bounded replacement blocker, prioritizing Todo detail/subtask/session/relationship parity, with legacy-vs-Vue data-contract tests.
51. Status: complete - Run focused Vue tests, production build, full Vue suite, isolated master legacy verification, and `git diff --check`; fix all regressions in scope.
52. Status: complete - Update parity acceptance evidence and migration progress, then commit the verified stage without touching protected branches or stash.
53. Status: complete - Add legacy-compatible Todo date/group/exclusive filters and linked-record deep navigation without mutating persisted data.
54. Status: complete - Add read-only filtering/navigation regression coverage and rerun Vue build/check plus responsive verification.
55. Status: complete - Update parity evidence and commit the verified Todo navigation/filter stage.
56. Status: complete - Add `todo=<id>` detail deep links, Dashboard and calendar Todo entry points, legacy plan/due schedule items, and date presets.
57. Status: complete - Add route/preset/schedule contract coverage and run Vue build/check plus desktop/mobile verification.
58. Status: complete - Update parity evidence and commit the verified Todo cross-entry stage.
59. Status: complete - Add Todo-detail record relationship creation/removal while preserving exclusive-source invariants and record-owned fields.
60. Status: complete - Add persisted relationship contract coverage and run Vue build/check plus responsive verification.
61. Status: complete - Update parity evidence and commit the verified Todo relationship stage.
62. Status: complete - Audit legacy Todo independent sync keys, fixed path, preview/apply/upload state machine, and reusable service/repository boundaries.
63. Status: complete - Implement Vue Todo remote preview, merge apply, protected existing upload, and session-armed first creation.
64. Status: complete - Add GET/PUT sequence, conditional header, persistence, mirror, snapshot, and race-protection contract tests.
65. Status: complete - Run Vue build/check and desktop/mobile visual verification for the independent Todo sync surface.
66. Status: complete - Update parity evidence and commit the verified Todo independent sync stage.
67. Status: complete - Audit legacy built-in/custom record templates, structured-field Markdown generation, persistence, and deletion contracts.
68. Status: complete - Implement Vue built-in template selection, structured field editing, and legacy-compatible record persistence.
69. Status: complete - Implement custom record template creation, application, and protected deletion with tombstones.
70. Status: complete - Add template contract tests and run Vue build/check plus desktop/mobile visual verification.
71. Status: complete - Update parity evidence and commit the verified Records template stage.
72. Status: complete - Audit legacy idea-specific record fields, filters, Todo linkage, and Vue navigation gaps.
73. Status: complete - Implement idea-specific editing and preview in the shared Vue Records editor.
74. Status: complete - Implement Ideas filters, Records deep navigation, and linked Todo detail routing with legacy-compatible status updates.
75. Status: complete - Add idea persistence/navigation contracts and run build/check plus desktop/mobile verification.
76. Status: complete - Update parity evidence and commit the verified idea-detail stage.
77. Status: complete - Audit legacy record autosave debounce, dirty-state, close/switch flush, and current Vue editor lifecycle.
78. Status: complete - Implement repository-backed existing-record autosave with manual save and navigation flush semantics.
79. Status: complete - Add autosave timing/flush contracts and run build/check plus responsive status verification.
80. Status: complete - Update parity evidence and commit the verified existing-record autosave stage.
81. Status: complete - Audit legacy diary AI payload, normalization, editable draft, overwrite confirmation, Todo creation, and relationship contracts.
82. Status: complete - Implement store-backed diary section writeback and linked AI Todo creation without mutating data before confirmation.
83. Status: complete - Add the Records diary analysis surface with remote/local generation, editable section/Todo drafts, duplicate hints, and stale-request protection.
84. Status: complete - Add mocked-network and persistence contracts, then run build, focused/full checks, and desktop/mobile visual verification.
85. Status: complete - Update migration parity evidence, package the verified runtime, commit the diary AI stage, and append dual-store memory.
86. Status: complete - Audit legacy new-record type selection, meaningful-input gate, default fields/templates, scoped reuse, debounce, close, and navigation flush contracts.
87. Status: complete - Add a dedicated Vue record-create modal and store-backed first-save/upsert path while keeping blank initialization read-only.
88. Status: complete - Add Playwright contracts for blank close, three-second first persistence, close/navigation flush, structured template fields, idea fields, and scoped reuse.
89. Status: complete - Run production build, focused/full checks, and desktop/mobile modal verification without horizontal overflow.
90. Status: complete - Update parity evidence, package, commit the verified new-record stage, and append dual-store memory.
91. Status: complete - Audit the legacy Records keyword, type, day-order, idea-status, idea-tag, range, and schedule-inclusion contracts against Vue.
92. Status: complete - Implement the legacy Records filter controls and shared list/calendar event inclusion semantics without persistence side effects.
93. Status: complete - Add read-only Playwright contracts for search fields, idea filters, day ordering, ranges, type semantics, and schedule entries.
94. Status: complete - Run production build, focused/full checks, and desktop/mobile visual verification without horizontal overflow.
95. Status: complete - Update parity evidence, package, commit the verified Records filter stage, and append dual-store memory.
96. Status: complete - Audit legacy Materials fields, modal lifecycle, filtering, random review, sorting, deep-link, and tombstone contracts against Vue.
97. Status: complete - Implement repository-backed Material create/edit/delete plus legacy keyword/type/tag filters and random review.
98. Status: complete - Add exact persistence, tombstone, read-only filtering/randomization, and route restoration Playwright contracts.
99. Status: complete - Run production build, focused/full checks, and 1440px/390px visual verification for Materials.
100. Status: complete - Update parity evidence, package, commit the verified Materials stage, and append dual-store memory.
101. Status: complete - Audit legacy Dashboard summary, command center, timeline, and navigation contracts against Vue.
102. Status: complete - Implement read-only Vue Dashboard command center, active-period/timeline entry points, and legacy-compatible summary counts without persistence side effects.
103. Status: complete - Add Dashboard contract tests for navigation, bounded timeline content, summary semantics, and storage immutability.
104. Status: complete - Run production build, focused/full checks, and 1440px/390px visual verification for Dashboard.
105. Status: complete - Update parity evidence, package, commit the verified Dashboard stage, and append dual-store memory.
106. Status: complete - Audit legacy Goals detail, create/edit/delete, progress/status, route, and tombstone contracts against Vue.
107. Status: complete - Implement Vue Goals detail modal/deep link and legacy-compatible save/delete contracts.
108. Status: complete - Add focused Goals Playwright contract coverage and run build/check gates.
109. Status: complete - Update parity evidence, package, commit the verified Goals stage, and append dual-store memory.
110. Status: complete - Audit legacy global search and tag-center indexing/navigation contracts against Vue.
111. Status: complete - Implement read-only Vue Search/Tags full-index grouping, module scope, tag scope, and precise route entry points.
112. Status: complete - Add Search/Tags read-only navigation contract coverage and run build/check/responsive gates.
113. Status: complete - Update parity evidence, package, commit the verified Search/Tags stage, and append dual-store memory.
114. Status: complete - Audit legacy Import/Export snapshots, merge, tombstone, dirty-state, and mirror contracts against Vue.
115. Status: complete - Implement any missing Vue Import/Export data-safety contract fixes.
116. Status: complete - Add focused Import/Export Playwright contract coverage and run build/check gates.
117. Status: complete - Update parity evidence, package, commit the verified Import/Export stage, and append dual-store memory.
118. Status: complete - Audit legacy Fitness multi-exercise plan, live workout, history, and plan writeback contracts against Vue.
119. Status: complete - Implement Vue Fitness multi-exercise plan editing and plan-start workout coverage through existing fitness-service contracts.
120. Status: complete - Implement Vue Fitness finish-time plan writeback control without automatic persisted mutation before user confirmation.
121. Status: complete - Add focused Fitness persisted-data contract coverage and run build/check plus responsive verification.
122. Status: complete - Update parity evidence, package, commit the verified Fitness stage, and append dual-store memory.
123. Status: complete - Audit legacy Fitness workout history create/edit contract and select a bounded Vue history editor shape.
124. Status: complete - Implement Vue Fitness completed/planned workout history create/edit through `fitness-service.js` without adding a new authority.
125. Status: complete - Add focused history persistence, tombstone, dirty-state, and no-mirror contract coverage.
126. Status: complete - Run build/check plus 1440px/390px responsive verification for the Fitness history editor.
127. Status: complete - Update parity evidence, package, commit the verified Fitness history stage, and append dual-store memory.
128. Status: complete - Audit legacy Habit checkin note, makeup, undo, reward reversal, mirror, and tombstone contracts against Vue.
129. Status: complete - Implement Vue Habit note checkin, backfill, note edit, and undo-latest checkin without touching remote upload.
130. Status: complete - Add focused Habit local contract tests for checkins, ledger rewards/reversals, deletedItems, dirty state, and `habitAppData` mirror.
131. Status: complete - Run build/check plus 1440px/390px responsive verification for the Habit correction surface.
132. Status: complete - Update parity evidence, package, commit the verified Habit correction stage, and append dual-store memory.
133. Status: complete - Audit legacy Habit base edit/delete fields, record retagging, tombstones, mirror, and current Vue page UX gaps.
134. Status: complete - Implement Vue Habit base edit/delete plus scoped form polish without touching reward/wallet/remote flows.
135. Status: complete - Add focused Habit base management contract tests for update, delete, checkin tombstones, record cleanup, dirty state, and `habitAppData` mirror.
136. Status: complete - Run build/check plus 1440px/390px responsive verification for the polished Habit management surface.
137. Status: complete - Update parity evidence, package, commit, push the verified Habit base management stage, and append dual-store memory.
138. Status: complete - Audit legacy Wheel canvas click/drag, tag first-stage, history, and current Vue visual/interaction gaps.
139. Status: complete - Implement Vue Wheel canvas rendering, click/drag spin entry points, and tag first-stage label correction without touching remote sync.
140. Status: complete - Add focused Wheel interaction contract tests for canvas click, drag, tag two-stage result, history, Todo conversion, and dirty state.
141. Status: complete - Run build/check plus 1440px/390px responsive verification for the Wheel interaction surface.
142. Status: complete - Update parity evidence, package, commit, push the verified Wheel interaction stage, and append dual-store memory.
143. Status: complete - Audit legacy Wheel public-library tag filter, selection count, batch tag, batch enable/disable, and batch delete contracts.
144. Status: complete - Implement Vue Wheel public-library filter, selection, and bounded batch operations without touching independent remote sync.
145. Status: complete - Add focused Wheel public-library batch contract tests for tag add/remove, only-tag guard, enable/disable, tombstones, and dirty state.
146. Status: complete - Run build/check plus 1440px/390px responsive verification for the public-library management surface.
147. Status: complete - Update parity evidence, package, commit, push the verified Wheel public-library stage, and append dual-store memory.
148. Status: complete - Audit legacy Wheel independent sync and define a bounded GET-only preview/apply slice.
149. Status: complete - Implement Vue Wheel remote preview/apply panel with fixed `/apps/wheel-app/data.json`, schema checks, merge preview, recheck, snapshots, and dirty state.
150. Status: complete - Add focused Wheel remote preview/apply contract tests for GET-only preview, race recheck, merge persistence, tombstones, and disabled upload authority.
151. Status: complete - Run build/check plus 1440px/390px responsive verification for the Wheel sync surface.
152. Status: complete - Update parity evidence, package, commit, push the verified Wheel remote preview/apply stage, and append dual-store memory.
153. Status: complete - Audit the just-added Wheel preview/apply panel and define the protected upload/create state machine.
154. Status: complete - Implement Vue Wheel existing-file conditional upload and session-armed first creation with readback verification.
155. Status: complete - Add focused Wheel protected upload/create contract tests for If-Match, If-None-Match, race refusal, readback hash, and restored upload-authority reset.
156. Status: complete - Run build/check plus 1440px/390px responsive verification for the expanded Wheel sync surface.
157. Status: complete - Update parity evidence, package, commit, push the verified Wheel protected upload/create stage, and append dual-store memory.
158. Status: complete - Audit Wheel management-form polish gaps and choose a bounded no-contract-change UI slice.
159. Status: complete - Polish Vue Wheel management forms with stable summary, labeled controls, responsive grids, and no premature writes.
160. Status: complete - Add focused Wheel management-form UI contract coverage for edit focus and read-only form filling.
161. Status: complete - Run build/check plus 1440px/390px responsive verification for the polished Wheel management surface.
162. Status: complete - Update parity evidence, package, commit, push the verified Wheel management polish stage, and append dual-store memory.
163. Status: complete - Audit Fitness body-metric legacy fields and choose a bounded full-field editing slice.
164. Status: complete - Expand Vue Fitness body metric form/list to the shared legacy metric field and condition definitions.
165. Status: complete - Add focused Fitness body metric contract coverage for full-field create/edit/delete, dirty state, tombstones, and no mirror.
166. Status: complete - Run build/check plus 1440px/390px responsive verification for the expanded body metric surface.
167. Status: complete - Update parity evidence, package, commit, push the verified Fitness body metric stage, and append dual-store memory.
168. Status: complete - Audit Fitness live workout rest timer and last-performance suggestion gaps.
169. Status: complete - Add Vue live workout rest timer controls and service-backed last-performance suggestion actions.
170. Status: complete - Add focused Fitness live workout coverage for suggestion apply, persisted active workout sets, rest timer display, timer controls, and dirty state.
171. Status: complete - Run build/check plus 1440px/390px responsive verification for the live workout timer/suggestion surface.
172. Status: complete - Update parity evidence, package, commit, push the verified Fitness live workout assist stage, and append dual-store memory.
173. Status: complete - Audit Habit independent remote preview rules and choose a bounded GET-only Vue Sync-page slice.
174. Status: complete - Add the Vue Habit independent sync panel with fixed `/apps/habit-app/data.json`, config reset, local/remote/merged preview, and no apply/upload path.
175. Status: complete - Add focused Habit remote preview coverage proving one GET, no PUT, and unchanged `lifePlanData`, `habitAppData`, and `habitAppSyncState`.
176. Status: complete - Run build/check plus responsive verification for the Habit read-only sync panel.
177. Status: complete - Update parity evidence, package, commit, push the verified Habit read-only remote preview stage, and append dual-store memory.
178. Status: complete - Audit Habit preview/apply parity risks with multi-agent sidecars, especially preview read-only state, legacy reverse mapping, tombstone conversion, and remote ID preservation.
179. Status: complete - Implement guarded Vue Habit apply-to-local with second GET recheck, cloud-race refusal, application-before snapshot, legacy slice conversion, mirror rebuild, and sync metadata updates.
180. Status: complete - Add focused Habit remote apply tests for two-GET zero-PUT success, legacy field/tombstone mapping, local mirror rebuild, dirty state, and cloud-change refusal.
181. Status: complete - Run production build and focused Habit remote preview/apply checks before full verification.
182. Status: complete - Update evidence, run full checks/package, verify protected refs, commit, push, and append dual-store memory for the Habit remote apply stage.
183. Status: complete - Audit Habit protected existing-upload parity and choose a bounded if-match plus readback slice.
184. Status: complete - Implement Vue Habit existing-file protected upload with baseline recheck, confirmation, If-Match write, and readback verification.
185. Status: complete - Add focused Habit protected-upload Playwright coverage for success and cloud-race refusal without automatic retry.
186. Status: complete - Run production build and focused Habit remote checks before final verification.
187. Status: complete - Update docs/progress, run full checks/package, verify protected refs, commit, push, and append dual-store memory for the Habit protected upload stage.
188. Status: complete - Audit Habit session-armed first-create parity and align it with Todo/Wheel create-only state machines.
189. Status: complete - Implement Vue Habit missing-file first creation with current-session arm, second GET absence check, If-None-Match write, readback verification, and no automatic retry.
190. Status: complete - Add focused Habit first-create Playwright coverage for disabled-until-armed success and final-recheck race refusal.
191. Status: complete - Run production build and focused Habit first-create checks before full verification.
192. Status: complete - Update docs/progress, run full checks/package, verify protected refs, commit, push, and append dual-store memory for the Habit first-create stage.
193. Status: complete - Audit in-progress Habit advanced reward/penalty/milestone management diff and preserve the existing dirty work instead of switching modules.
194. Status: complete - Expose Vue Habit advanced reward, penalty, break-penalty, and milestone fields through the management form.
195. Status: complete - Extend `habitsStore` create/update normalization so advanced fields persist and referenced currencies are created.
196. Status: complete - Add focused Habit management coverage for advanced field editing, milestone persistence, currency creation, mirror rebuild, dirty state, and tombstones.
197. Status: complete - Run full verification, package, commit, push, and append dual-store memory for the Habit advanced reward fields stage.
198. Status: complete - Audit Vue `chatCapture` against legacy multi-destination writeback and preserve generate-as-draft behavior.
199. Status: complete - Implement Vue `chatCapture` confirmed writeback for Todo, diary append/create, work record, day plan append/create, and idea capture without adding a new authority.
200. Status: complete - Add focused AI chat-capture contract coverage for no-write generation, per-target writes, mirrors, dirty state, scoped record reuse, and structured diary content.
201. Status: complete - Run build/typecheck/focused/full checks plus responsive verification for the expanded AI page.
202. Status: complete - Update parity evidence, package if applicable, verify protected refs, commit, push, and append dual-store memory for the chatCapture writeback stage.
203. Status: complete - Audit module-level independent auto-sync and finish the coherent Todo/Wheel/Habit guarded conditional auto-sync slice together.
204. Status: complete - Implement Vue Todo/Wheel/Habit auto-sync with explicit opt-in, fixed independent paths, existing-file If-Match upload, visibility resume, and no background first-create.
205. Status: complete - Add focused Todo/Wheel/Habit auto-sync coverage for unsafe config sanitization, disabled idle behavior, dirty upload, missing remote no-create, remote pull, and main dirty propagation.
206. Status: complete - Run build/typecheck/focused/full checks plus responsive verification for the Todo/Wheel/Habit auto-sync surfaces.
207. Status: complete - Update parity evidence, verify protected refs, commit, push, and append dual-store memory for the module auto-sync stage.
208. Status: complete - Implement Habit archive/restore soft-state, wish create/archive, wallet redeem ledger writes, and read-only diagnostics summary/top issues.
209. Status: complete - Map diagnostics UI to legacy `makeIssue` fields (`label`/`hint`) and keep diagnostics free of `lifePlanData` / `habitAppData` writes.
210. Status: complete - Add focused Habit archive/wishes/wallet/diagnostics Playwright coverage and pass full Vue smoke 74/74 plus build/check.
211. Status: complete - Update parity evidence, verify protected refs, commit, push, and append dual-store memory for the Habit archive/wallet/wishes/diagnostics stage.
212. Status: complete - Implement Dashboard Todo quick-writes: planForToday, quickSession, and checkbox toggle with local todo mirror rebuild.
213. Status: complete - Add focused Dashboard quick-write Playwright coverage while keeping the read-only Dashboard contract green; full Vue smoke 75/75.
214. Status: complete - Update parity evidence, verify protected refs, commit, push, and append dual-store memory for the Dashboard Todo quick-write stage.
215. Status: complete - Implement Habit settle-through-yesterday miss/break penalty writes with idempotent sourceIds and no-op dirty protection.
216. Status: complete - Add focused Habit penalty settlement Playwright coverage and pass full Vue smoke plus build/check.
217. Status: complete - Update parity evidence, verify protected refs, commit, push, and append dual-store memory for the Habit penalty settlement stage.
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
- Habit remote preview remains strictly read-only: it may GET `/apps/habit-app/data.json`, but must not mutate legacy habit fields, `localStorage.habitAppData`, `habitAppSyncState`, or remote data; `autoSync` and `remoteUploadEnabled` remain `false`.
- Habit remote apply is local-only: it must second-GET and refuse cloud races before snapshots or persistence, convert the merged canonical Habit app snapshot back into legacy `lifePlanData` Habit collections/tombstones, rebuild the local-only mirror, update sync metadata, and never PUT or create remote files.
- Habit protected upload is for existing remote files only: it must second-GET, require ETag/confirmation, use `If-Match`, verify the readback hash, and never auto-retry after an uncertain PUT.
- The protected first-upload phase supersedes the permanent-false part only during an explicitly armed browser session: `remoteUploadEnabled` starts false, is never restored from storage, and automatically returns false after any upload attempt. It must second-GET the missing path, write with `If-None-Match: *`, verify by readback hash, and never introduce automatic upload or an authority switch.
- Habit bootstrap must reuse the already configured unified sync endpoint. The user should not have to enter or migrate a second habit-specific URL; only `/apps/habit-app/data.json` remains habit-specific.
- Vue Todo independent sync must reuse `lifePlanSyncConfig.webdavUrl`, keep `/apps/todo-app/data.json` fixed, persist `todoAppSyncConfig` / `todoAppSyncState`, and force `autoSync` plus restored upload authorization off.
- Dashboard parity should close read-only replacement blockers first: summary semantics, command-center entry points, active periods, and bounded timeline navigation. Legacy quick-write actions such as "今天做", "执行一次", and habit check-in remain out of this Dashboard slice unless they are separately audited and covered.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Subagent spawn failed through local proxy on inherited `gpt-5.5` | First read-only explorer used inherited model | Restarted parallel explorers with `gpt-5.4-mini` and continued main-thread work |
| GitHub HTTPS push failed from direct network | `git push origin master` failed with `Connection was reset` / `Couldn't connect to server`; `Test-NetConnection github.com -Port 443` also failed, while `ssh.github.com:443` was reachable but local SSH auth lacked a GitHub key | Detected local proxy service on `127.0.0.1:7897` and pushed with temporary per-command Git proxy: `git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin master`; do not change global Git config |
| First final full site check reported 3 merge regressions | Latest `app-sync-kit` life-plan adapter used remote-wins `>=` ties, unlike the site's local-safe `>` fallback, so unstamped old backups could overwrite local items | Changed adapter ties to preserve local data, added life-plan adapter regression checks, rebuilt/copied the browser bundle, passed the 3 focused tests, then passed all 63 site tests |
| Parallel source-reading wrapper exited with no nested output | First 2026-07-27 Todo parity audit batch combined six large reads | Retried in smaller batches and kept the failed wrapper read-only; no project state changed |
| Todo detail CSS patch anchor was absent | First style patch assumed a `.sync-actions` line in `src/styles/app-shell.css` | Inspected the actual file tail and reapplied at an existing end-of-file boundary; failed patch made no changes |
| Focused Todo contract test had an ambiguous `任务` label locator | First Playwright run matched task, subtask region, and subtask inputs | Changed the main task locator to exact label matching; application reached the editor without runtime errors |
| Focused Todo contract test used the edit-state subtask name in view state | Second run proved both subtasks persisted, but native wrapped labels exposed checkbox names as the subtask text | Switched view-state checks to role/name locators matching the accessibility tree |
| `npm run test:legacy` exceeded the 5-minute command timeout and later loaded the Vue entry | Direct legacy regression attempts from `migration/vue-app-v1` | Exported protected `master` to ignored `.tmp`, ran master syntax checks, then passed all 73 master Playwright tests with its own static server/config; current-branch legacy command is not a valid gate because `index.html` is intentionally Vue |
| First Todo relationship test still found an unlinked record title | Assertion expected the title to disappear from the whole detail panel | Confirmed the record correctly returned to the candidate select and changed the assertion to require the linked-row unlink command to disappear |
| Session-authorization fixture patch first matched the existing-upload setup | Reused sync setup lines were not unique enough | Kept that compatibility coverage and added the stale authorized config explicitly to the first-creation fixture before rerunning it |
| First built-in Records template contract timed out on a nested `details.filter({ has: scoped locator })` selector | Focused two-test run; custom template contract passed | Replaced the over-scoped matcher with exact `summary` text locators and retained the browser-visible interaction path |
| Second built-in Records template contract expected one fewer newline between consecutive empty sections | Focused rerun reached the persisted-data assertion | Corrected the expected value to the legacy `fields.map(...).join('\\n\\n') + '\\n'` contract; implementation already matched legacy output |
| First idea-detail contract could see the labeled combobox in the accessibility snapshot but `getByLabel(..., { exact: true })` did not resolve it | Focused two-test run; idea conversion contract passed | Scoped the locator to the `灵感推进` region and selected its named combobox by role, avoiding the adjacent generic relationship controls |
| First autosave build rejected `@click="closeEditor"` after the function gained a boolean flush parameter | `vue-tsc` treated Vue's click payload as the first argument | Changed the template binding to `@click="closeEditor()"` so no `MouseEvent` is passed into the flush flag |
| First diary AI build could not narrow a result assigned inside the Pinia mutation callback and inferred AI urgency as arbitrary text | Initial production build after the store/UI patch | Switched the callback result to an explicit holder and constrained the draft urgency to `Todo['urgency']` before rebuilding |
| First full Records-filter check failed the existing Todo calendar cross-entry contract | The initial legacy audit removed plan/due events from both list and calendar | Kept the legacy exclusion for the list, restored the already-accepted Vue plan/due calendar entry points, and documented the intentional calendar superset |
| Parallel visual screenshots were not readable from the main workspace | The visual worker produced paths inside its isolated environment | Used its DOM overflow measurements as the defect evidence and scheduled fresh main-workspace measurements after the responsive fixes |
| First focused diary AI contract timed out locating the tomorrow checkbox through an outer-scoped nested `has` selector | The test had already passed request, normalized draft, and no-mutation assertions | Used the stable generated section order and scoped the checkbox to the second diary field item |
| Second focused diary AI contract received `medium` after the remote response specified `high` | Vue's legacy-service adapter passed `urgencyMeta`, while `ai-service.js` expects `todoUrgencyMeta`; it also omitted the local fallback's `addDays` dependency | Corrected both injected option names/implementations in `legacyServices.ts` and retained the persisted urgency assertion |
| First new-record visual pass showed structured textareas at their intrinsic narrow width | Desktop and mobile screenshots had no overflow but exposed an impractical editing width | Scoped template-field textareas inside the create modal to the full available width and reran responsive screenshots |
| Planning session-catchup helper was unavailable in the local `.claude` skill path | Resume step looked for `C:\Users\lihao\.claude\skills\planning-with-files\scripts\session-catchup.py` | Logged the missing helper and continued from current planning files plus `git status` evidence |
| First Materials random-review focused test timed out locating the tag group | The tag picker had `aria-label` but no `role=group`, so `getByRole('group')` could not resolve it | Added `role="group"` to the random tag picker and reran the Materials focused tests green |
| PTY dev-server start was rejected by Windows | `exec_command` with `tty: true` failed with access denied through the shell wrapper | Restarted the same `npm run dev` command as a normal non-interactive process |
| First correct mobile Materials visual pass clipped the bottom save action | Long dialog content plus stacked mobile action buttons left the final button only partially visible | Added a Materials-scoped sticky modal action row and reran desktop/mobile overflow screenshots green |
| First dev-server stop script failed on `$pid` | PowerShell reserves `$PID`/`$pid` as a read-only process ID variable | Renamed the loop variable to `$listenerId` and stopped the exact node listener on port 5174 |
| First Goals contract test expected no `todoAppData` after a Goal write | Vue repository commits rebuild the compatible Todo mirror for writes even when the Todo collection is empty | Changed the assertion to require mirror authority `lifePlanData.todos` with an empty `todos` array |
| First full Search/Tags check left an old Materials test targeting the removed standalone `素材标签` card | Search/Tags slice intentionally changed Tags to the legacy combined tag-center card layout | Updated the Materials test to click the new Beta tag-center card's `素材` count button |
| Habit diagnostics focused test failed to surface legacy issue labels | Vue diagnostics UI read `issue.title` / `issue.message`, but `habit-service.js.makeIssue` returns `label` / `hint` | Display `issue.label || issue.title || issue.type || issue.id` and `issue.hint || issue.message`, then reran the four Habit deep-water tests green |
| Search/Tags read-only subagent failed through local proxy | Spawned agent inherited `gpt-5.5` and upstream returned HTTP 503 auth unavailable | Continued the Search/Tags audit in the main thread using legacy `app.js`, Vue pages, and focused Playwright evidence |
| First Fitness build failed on removed `planForm.exerciseId` | Multi-exercise plan form replaced the old single-action field, but the action-library save path still filled the removed property | Routed new library items into the first blank plan exercise draft and reran `npm run build` green |
| First Fitness focused contract used inaccessible separated-label locators | Vue form labels are rendered as sibling text, not associated `label for` controls | Scoped the test to the Fitness plan form and used DOM locators inside the form |
| Second Fitness focused contract hit duplicate `删除` buttons | The plan row and workout history rows both contained the long plan title | Scoped the deletion assertion to the `开始计划训练` card |
| First Habit correction build rejected `Array.at()` | The project TypeScript lib target does not include ES2022 array helpers | Replaced `.at(-1)` with `checkins[checkins.length - 1]` and reran build |
| First full Habit correction check failed an existing quick-checkin locator | New `备注打卡/补卡` button also matched the old fuzzy `打卡` role locator | Changed the existing quick-checkin test to `exact: true` |
| Habit correction read-only sidecar failed before review | Subagent `Poincare` exceeded retry limit with upstream `429 Too Many Requests` | Continued main-thread contract review and verification; no project files were changed by the sidecar |
