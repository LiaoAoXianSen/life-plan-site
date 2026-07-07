# Findings

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

## 2026-07-06

- Project root is `D:\project\life-plan-site`.
- Existing root contains many old zip artifacts, including `life-plan-site-clean-*`, `life-plan-site-runtime-*`, and one larger `life-plan-site-sync-kit-20260705.zip`.
- User wants future work to always create a lean runtime zip after fixes and not preserve lots of old packages.
- User wants habit defaults changed: new habits should not grant coins by default.
- User wants periodic cyclic habit rewards, e.g. 7, 15, 21, 30 days, quarter, half-year, one year, repeating; milestone rewards can use different currencies; reward items can require a specific currency.
