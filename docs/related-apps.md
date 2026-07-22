# 相关独立 App 与拆分地图

生成日期：2026-07-19  
用途：记录「人生规划」周边独立 App 的磁盘位置、同步路径和与本站关系，避免后续遗忘或装错包。

本站仓库：`D:\project\life-plan-site`  
产品目标（已确认方向）：拆成多个独立手机 App（Capacitor + 多仓库），共用 Cloudflare Worker / WebDAV 同步底座。

---

## 1. 一句话结论

| 能力 | 独立 App 在哪 | 本站内嵌状态 | 云端路径 |
|---|---|---|---|
| 大转盘 | **`D:\project\wheel-app`**（正式线） | 仍有 `wheel-tool.js` 内嵌页 | `/apps/wheel-app/data.json` |
| 大转盘旧原生 | `D:\project\spin-wheel-app`（归档/勿当正线） | 无 | 无云同步，备份格式不兼容 |
| 同步底座 | `D:\project\app-sync-kit` | 本站 vendor 了 browser bundle | 多 path 共用同一 endpoint |
| 健身 / Core | 尚未独立建仓 | 仍在本站 | 规划中，见第 4 节 |
| 习惯 / 元气打卡 | **`D:\project\yuanqidaka`**（已有 Android App） | 本站旧习惯页待重做为 PC 习惯中心 | `/apps/habit-app/data.json`（规划/协议已建） |

**大转盘正式独立 App 就是 `D:\project\wheel-app`，不是 `spin-wheel-app`。**

---

## 2. 大转盘：三处代码分别是什么

### 2.1 正式独立 App（继续维护）

- **路径**：`D:\project\wheel-app`
- **形态**：npm workspaces monorepo  
  - `apps/mobile`：React 19 + Vite + Capacitor 6（`appId: com.wheelapp.mobile`）  
  - `packages/wheel-core`：数据模型 / 抽取逻辑 / 种子数据  
  - `docs/`：架构、阶段计划、对标等
- **同步**：依赖 `D:\project\app-sync-kit`（本地 `file:` 包）  
  - adapter：`app-sync-kit/packages/adapter-wheel-app`  
  - 默认远程路径：**`/apps/wheel-app/data.json`**  
  - 本地快照键：`wheel-app.snapshot.v1`（与本站 `lifePlanData` 分离）  
  - **2026-07-19 加固**（对齐本站防覆盖策略）：首次无基线且本地未 dirty 时只拉云端、不推种子；ETag/`If-Match` + 412 合并重试；删除写 `deletedAt`/`deletedItems` 墓碑；同步中 pending 补跑；危险上传二次确认
- **启动**（摘自该仓 README）：

```powershell
cd D:\project\wheel-app
npm install
npm run dev
```

- **打包相关脚本**：根目录 `npm run build` / `cap:sync` / `android`
- **和本站关系**：同一套逻辑数据模型（`wheels` / `wheelTags` / `wheelLibraryItems` / `wheelHistory`），**代码是重写不是共享源文件**；通过同一云路径与本站转盘切片互通。

### 2.2 本站内嵌转盘（仍可用，集成最深）

- **路径**：本仓  
  - `wheel-tool.js` / `wheel-tool.css`  
  - 宿主：`app.js`、`index.html` 的 `#page-wheel` 与同步弹窗
- **数据**：写在主文档 `lifePlanData` 的转盘字段里，**同时**可同步到 `/apps/wheel-app/data.json`
- **本站独有能力**：抽取结果 **转待办**（`convertWheelResultToTodo`）——独立 `wheel-app` 仅保留 `convertedTodoId` 字段，没有完整待办产品
- **同步配置键**：  
  - `lifePlanWheelSyncConfig`（默认 `remotePath: /apps/wheel-app/data.json`，复用主同步 `webdavUrl`）  
  - `lifePlanWheelSyncState`
- **合并入口**（本站）：`getWheelSnapshot` / `applyWheelSnapshot` / `mergeWheelSnapshots`（经 `sync-service.js`）

### 2.3 旧原生 Android 原型（勿当正线）

- **路径**：`D:\project\spin-wheel-app`
- **形态**：纯 Java/Gradle，`com.codex.spinwheel`，SQLite 离线
- **现状**：可装 debug APK，但 **无 INTERNET / 无 app-sync-kit**，备份 JSON schema 与 `/apps/wheel-app/data.json` **不兼容**
- **处理建议**：视为历史原型；新需求只改 `wheel-app`，避免两套安装包并存造成混淆

---

## 3. 同步与共享底座

| 组件 | 路径 | 备注 |
|---|---|---|
| 同步工具库 | `D:\project\app-sync-kit` | monorepo：`sync-core`、`webdav`、`adapter-wheel-app` 等 |
| 本站 browser 包 | `vendor/app-sync-kit.browser.global.js` | 运行时随本站打包 |
| Cloudflare Worker | 本仓 `worker.js` | 多 path → KV；ETag / If-Match |
| 主人生数据云路径 | `/life-plan.json` | `appId` 倾向 `life-plan` |
| 转盘云路径 | `/apps/wheel-app/data.json` | `appId` 倾向 `wheel-app` |

约定：

- **一个同步 endpoint（Worker/WebDAV 根）+ 多个 remote path = 多个 App 文档**
- 转盘独立 App 与本站内嵌转盘应对齐同一 path，避免各写各的文件名

---

## 4. 后续多 App 拆分备忘（未建仓）

已确认产品方向：4 个独立 App + Capacitor + 多仓库。转盘已完成独立线，其余规划：

| App | 建议仓库路径 | 建议云路径 | 本站数据切片 | 状态 |
|---|---|---|---|---|
| wheel | `D:\project\wheel-app` | `/apps/wheel-app/data.json` | `wheels*` 四集合 | **已有** |
| fitness | `D:\project\fitness-app`（建议） | `/apps/fitness-app/data.json` | `fitnessPlans` / `fitnessWorkouts` / `bodyMetrics` / `exerciseLibrary` | 未建；本站已有 `fitness-*.js/css` |
| habit | `D:\project\yuanqidaka`（已有 Android App）；如需 Web/Capacitor 独立壳再另建 `D:\project\habit-app` | `/apps/habit-app/data.json` | `habits` / records / ledger / rewards / currencies / milestones / overdue | App 已有；本站旧习惯页待重做为 PC 习惯中心；协议见 `app-sync-kit/docs/habit-app-schema.md` |
| life-plan-core | 本仓瘦身或新仓 | `/life-plan.json` | records / todos / goals / materials / AI 等 | 仍为本站主体 |

推荐落地顺序：转盘收尾（文档/内嵌策略）→ 习惯协议/PC 习惯中心 → yuanqidaka 同步迁移 → fitness-app → core 瘦身。

参考模板：直接照抄 `wheel-app` 的 monorepo + Capacitor + `app-sync-kit` adapter 模式。

---

## 5. 维护时注意

1. **改转盘业务优先改 `D:\project\wheel-app`**；本站 `wheel-tool.js` 仅在需要「站内集成 / 转待办」时再动。  
2. **不要**把 `spin-wheel-app` 的 SQLite/备份格式当成云同步 schema。  
3. 双端都写转盘时：统一 `/apps/wheel-app/data.json`，依赖合并与 tombstone；本站主文档里仍可能嵌有转盘字段（历史双写），迁移时注意冲突。  
4. 跨 App 联动（转盘结果 → 待办）目前只在本站完整存在；独立 App 默认不做强耦合。  
5. 习惯系统以 `D:\project\yuanqidaka` 的现有 App 体验为移动端参考，但同步数据标准以 `D:\project\app-sync-kit\docs\habit-app-schema.md` 为准；本站重做的是 PC 习惯中心，不要求和 App 长得一样。
6. 更新本文件时机：新建/废弃 sibling App、变更云 path、或正式移除本站内嵌转盘时。

---

## 6. 相关文档

- 本站功能索引（含内嵌转盘 API）：`docs/project-feature-index.md` §14  
- App 化 UI 方向：`docs/life-plan-app-redesign.md`（文中已点名 `D:/project/wheel-app`）  
- 问题跟踪（同步/转盘项）：`docs/project-issue-tracker.md`  
- 习惯系统重做方案：`docs/habit-system-redesign.md`
- 习惯同步协议：`D:\project\app-sync-kit\docs\habit-app-schema.md`
- 独立转盘仓内文档：`D:\project\wheel-app\docs\`（architecture、phase-1-plan 等）  
- 独立转盘 README：`D:\project\wheel-app\README.md`
