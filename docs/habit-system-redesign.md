# 习惯系统重做与多端同步方案

生成日期：2026-07-22  
当前结论：保留现有习惯能力的业务价值，但推翻旧驾驶舱；用 `app-sync-kit` 的 `habit-app` 协议作为后续 Web 与元气打卡 App 的共同数据标准。

---

## 1. 一句话定位

习惯系统不是要让 PC 端和手机端长得一样，而是让两端使用同一份习惯数据、同一套打卡/补卡/扣分/奖励语义。

| 端 | 定位 | UI 方向 |
|---|---|---|
| `D:\project\yuanqidaka` | 手机高频执行端 | 保留元气打卡现有风格：快速打卡、补签、愿望、提醒、逾期处理 |
| `D:\project\life-plan-site` | PC 完整操作端 | 重做成习惯运营中心：今日执行、补卡审计、习惯库、钱包、分析、迁移/同步控制 |
| `D:\project\app-sync-kit` | 同步/协议底座 | 定义 `/apps/habit-app/data.json`、normalize、merge、hash、安全验证 |

关键原则：

1. `yuanqidaka` 已经满足主要习惯打卡体验，短期不要把它改成另一个 Web 壳。
2. `life-plan-site` 的旧习惯页可以推翻重做，但不能丢掉已有操作能力。
3. Cloudflare Worker 继续保持通用 KV/WebDAV 存储，不写习惯业务合并逻辑。
4. 最终习惯权威文件是 `/apps/habit-app/data.json`，不是旧 `lifePlanData.habits/checkins`，也不是元气打卡的 Room 自增主键。

---

## 2. 当前判断

### 2.1 life 旧习惯模块的问题

旧模块不是完全没用，它有这些能力：

- 今日打卡
- 补卡
- 撤销/减少次数
- 备注
- 心愿/奖励
- 积分流水
- 币种管理
- 热力图、矩阵、统计、历史

但问题也明显：

1. 默认入口偏热力图/旧列表，不像一个 PC 习惯运营中心。
2. 删除习惯会连带清理历史，长期不适合多端同步。
3. streak/完成率更偏自然日打卡，对复杂规则不够精确。
4. 钱包账本和元气打卡的奖励/罚款/里程碑语义不统一。
5. 与未来 `/apps/habit-app/data.json` 同时存在时，容易出现两套权威。

结论：旧 life 习惯模块应“保留引擎，换掉驾驶舱”。

### 2.2 yuanqidaka 的状态

`D:\project\yuanqidaka` 是当前更满意的手机习惯 App，但它还不是同步安全的数据源：

- Room 表使用本地自增 `Long` 主键，不能直接作为云端 ID。
- 需要补 `remoteId`、`updatedAt`、`deletedAt`。
- 用户删除需要变成软删/tombstone，再同步到云端。
- 奖励、罚款、里程碑 claim 需要确定性 source key，避免双端重复发奖/扣分。
- 现有备份 JSON 偏导出/导入，不适合作为多端合并协议。

结论：元气打卡先作为行为与语义标准，后续通过 mapper 接入 habit-app snapshot。

---

## 3. 共同数据协议

协议文档在：

- `D:\project\app-sync-kit\docs\habit-app-schema.md`
- adapter 初版在：`D:\project\app-sync-kit\packages\adapter-habit-app`

默认云端路径：

```text
/apps/habit-app/data.json
```

云端文件使用 legacy raw JSON：

```json
{
  "habits": [],
  "habitGroups": [],
  "habitRecords": [],
  "habitRewards": [],
  "habitRewardRecords": [],
  "habitFineRecords": [],
  "habitLedger": [],
  "habitCurrencies": [],
  "habitMilestones": [],
  "habitMilestoneClaims": [],
  "habitOverdueEvents": [],
  "habitMoodNotes": [],
  "habitTimeTasks": [],
  "deletedItems": []
}
```

协议重点：

1. 所有同步实体使用稳定字符串 `id`。
2. 所有同步实体支持 `createdAt / updatedAt / deletedAt`。
3. tombstone 胜过旧实体，较新的同 id 实体可以恢复。
4. `habitLedger` 是跨端余额真相；merge 不创造金钱。
5. ledger 用 `type + sourceId + currencyId` 幂等合并。
6. milestone claim 用 `habitId + milestoneId + cycleStartDate + achievedDays + currencyId` 幂等合并。
7. overdue event 用 `habitId + dueDate` 合并，终态优先。
8. `normal/makeup/exempt/overdue_break` 必须区分完成次数和连续性：
   - `normal`: 完成=true，连续=true
   - `makeup`: 完成=true，连续=true
   - `exempt`: 完成=false，连续=true
   - `overdue_break`: 完成=false，连续=false

---

## 4. PC 端习惯中心 IA

PC 端不是 App 的复制品，应该是更适合大屏的管理/审计/分析界面。

建议主结构：

1. **习惯中心 Header**
   - 今日日期
   - 同步状态
   - 快捷新增
   - 迁移/诊断入口

2. **KPI Strip**
   - 今日应完成/已完成
   - 今日获得/扣除
   - 连续表现
   - 待处理逾期
   - 钱包总览

3. **Tabs**
   - 今日
   - 补卡
   - 习惯库
   - 钱包
   - 分析
   - 设置/同步

### 4.1 今日

复用旧 `renderTodayHabits` 的能力，但重排为中心主工作台。

必须保留：

- 打卡
- 打卡并备注
- 再记一次
- 撤销/减少一次
- 今日进度
- 当前连续/目标提示

### 4.2 补卡

新增日期选择器，按选中日期展示习惯行。

每行提供：

- 当日次数
- 补卡
- 备注补卡
- 撤销/减少一次
- 当日是否应完成、是否已逾期/扣分

短期仍调用旧函数：

- `toggleCheckin(habitId, selectedDate)`
- `decreaseCheckin(habitId, selectedDate)`
- `openHabitNoteModal({ habitId, date: selectedDate })`

长期必须对齐元气打卡补卡语义：

- 不能补未来日期
- 当日必须是 due day
- 已 fined/exempt 的 overdue event 不应随意补卡
- makeup 满足 pending/deferred 后，overdue event 变为 `made_up`

### 4.3 习惯库

作为 PC 管理页，不再只是简单列表。

列建议：

- 名称
- 分组/标签
- 规则
- 奖励/罚款
- 今日状态
- 当前连续
- 最后操作
- 编辑
- 归档/删除

长期删除策略：默认归档，危险硬删单独放高级操作。

### 4.4 钱包

把旧奖励面板升级为钱包页。

保留：

- 多币种余额
- 心愿/奖励商品
- 兑换记录
- 近期流水
- 新增心愿
- 调整积分
- 币种管理
- 结算昨日扣分

长期绑定 canonical `habitLedger`，而不是只依赖旧 life 字段。

### 4.5 分析

保留旧分析能力，但不再让热力图成为默认入口。

可复用：

- `renderHeatmap`
- `renderHabitMatrix`
- `renderHabitStats`
- `renderHabitCheckinHistory`

长期统计要按 due rule、required count、completion/streak flags 重算。

---

## 5. 分阶段落地

当前进度：`life-plan-site` 已完成 Phase 1 的 PC 习惯中心入口重排，完成 Phase 2/3 的只读诊断、映射预览、snapshot JSON 预览与预览指纹展示，并完成 Phase 4 本地双写第一版：全部 11 条习惯写路径在保存后会全量重建 `localStorage.habitAppData`；仍未上传 `/apps/habit-app/data.json`，也尚未接入独立 `habitSyncConfig`。

### Phase 1：PC 习惯中心 UI/IA 替换

目标：让用户感觉旧习惯页已经换成 PC 习惯中心。

只做：

- 替换页面结构和入口
- 复用旧数据字段
- 复用旧函数和 modal
- 保留全部已有操作

不做：

- 不迁移数据
- 不写 `/apps/habit-app/data.json`
- 不改 Worker
- 不删除旧函数
- 不改变现有同步权威

状态：已完成第一版。当前页面包含 `今日 / 补卡 / 习惯库 / 钱包 / 分析 / 诊断`，仍复用旧数据与旧操作函数。

此阶段旧 life 数据仍是权威。

### Phase 2：抽象 habit service

把旧零散函数逐步收敛为 service：

- 查询今日习惯
- 查询某日可补卡习惯
- 打卡/撤销/备注
- 奖励/罚款/兑换
- 统计/余额
- 删除/归档

状态：已完成第一版只读 `habit-service.js`，先覆盖诊断、风险检查和 snapshot 预览相关查询；写入路径仍留在旧函数内，没有切到新 snapshot。

UI 不直接拼旧字段，为迁移 snapshot 做准备。

### Phase 3：生成 habit-app snapshot 预览

从旧 life 数据生成只读 snapshot，用于迁移诊断。

诊断项：

- habit 数量
- record/checkin 数量
- 多币种余额
- reward 数量
- orphan checkins
- orphan ledger
- tombstone 筛选结果

状态：已完成第一版。诊断页现在展示 legacy 数量、风险检查、habit-app 映射预览、只读 JSON 预览和预览指纹，便于后续对比双写前后的数据是否一致。

此阶段仍以旧 life 数据为权威。

### Phase 4：双写旧 life 数据和 habit-app snapshot

进入前置门槛：

- 诊断页无重复 ID、孤儿 checkin、孤儿 ledger、异常金额、未来打卡等高风险项。
- 预览指纹能在同一份旧数据上保持稳定，用于排查非预期变化。
- 先做本地双写和测试，不先开启远端上传。
- 双写代码必须围绕现有打卡、撤销、备注、补卡、钱包兑换等写路径逐个接入，不能一次性替换所有旧数据。

前置状态：已完成第一版 readiness，并支持手动重建本地镜像。

- `habit-service.js` 提供 `getHabitDualWritePathInventory()`、`buildHabitDualWriteReadiness()`、`buildHabitAppLocalMirror()`。
- 诊断页新增「本地双写前置」卡片：状态、阻塞项、11 条写路径清单、下一步动作。
- 诊断页可手动重建 `localStorage.habitAppData` 本地镜像；标记 `localMirror: true`、`remoteUploadEnabled: false`。
- 全部 11 条写路径已 `dualWrite: enabled`：打卡、备注、习惯编辑/删除、心愿、兑换、积分调整、扣分结算、币种管理。
- 当前策略是写成功后全量重建 `localStorage.habitAppData`，不是增量 patch，也不是云端上传。
- 数据无 danger 且全部写路径已接入时状态为 `ready`；有 danger 时为 `blocked`。

每次操作同时写：

- 旧 `data.habits / data.checkins / data.habitPointLedger / data.habitRewards / data.habitCurrencies`
- 新 habit snapshot

一致性校验：

- 打卡后两边 record 数量一致
- 撤销后 ledger 反冲一致
- 兑换后 reward redeemedCount/ledger 一致
- 多币种余额一致

双写失败时：

- 旧数据作为 fallback
- snapshot 标记 dirty/conflict
- UI 提示修复

### Phase 5：接入独立习惯同步

新增类似 wheel 的独立同步配置：

- `habitSyncConfig`
- `habitSyncState`
- `habitAutoSyncTimer`
- `habitSyncIntervalTimer`
- `isHabitCloudSyncing`
- `pendingHabitCloudSync`
- 默认路径 `/apps/habit-app/data.json`

`sync-service.js` 后续需要类似能力：

- `getHabitSnapshot`
- `getHabitDataHash`
- `mergeHabitSnapshots`
- habit tombstone 判定

### Phase 6：yuanqidaka 接入 mapper

元气打卡需要先做 Room migration，不要直接拿本地 Long 主键同步：

1. 核心表增加 `remoteId / updatedAt / deletedAt`。
2. 增加 `SyncIdMap`。
3. 本地存同步配置和状态。
4. 迁移时一次性生成 remote id。
5. AppRepository 所有写路径更新时间戳。
6. 用户删除改软删，保留 tombstone。
7. 增加 Room <-> HabitSnapshot mapper。
8. 先做 one-way export/import 测试，再做网络同步。

### Phase 7：habit-app snapshot 成为权威

最终：

- `/apps/habit-app/data.json` 是习惯最终标准。
- `life-plan-site` 的旧 habit 字段只作为 fallback cache 或迁移备份。
- PC 端仍可完整操作习惯，不是只读摘要。
- 手机端继续保持元气打卡风格。

---

## 6. 不要现在做的事

1. 不要把 life todos 混进 habit sync；待办以后单独判断。
2. 不要让 Worker 做习惯业务合并。
3. 不要用 Room 自增 id 当云端 id。
4. 不要让 PC 和 App 各自扫描逾期后生成重复罚款。
5. 不要在 merge 中生成新的奖励/扣款流水。
6. 不要硬删同步实体后再指望别的端知道删除。

---

## 7. 当前已落地记录

- `D:\project\yuanqidaka` 已提交当前本地升级版本：`3198019 feat: upgrade local habit app experience`。
- `D:\project\app-sync-kit` 已新增 habit-app 协议文档与 adapter 初版。
- `D:\project\app-sync-kit` 已规划并加入 habit 同步安全验证脚本。
- `D:\project\life-plan-site` 已提交 PC 习惯中心 Phase 1、只读诊断、habit-app snapshot JSON 预览、预览指纹、Phase 4 本地双写前置 readiness，以及本地 `habitAppData` 镜像重建入口。

下一步应该优先做：

1. 给本地双写补更细的一致性校验面板：`habitRecords` / `habitLedger` 数量、余额、sourceHash 对比。
2. 视需要把全量重建改成写路径增量 patch，降低频繁操作成本。
3. 等本地双写稳定后，再接入独立 `habitSyncConfig` 与 `/apps/habit-app/data.json` 上传下载。
4. 最后再对 `yuanqidaka` 做 Room sync migration。
