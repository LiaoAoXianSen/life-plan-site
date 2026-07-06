# life-plan-site 功能总索引

本文档用于给后续维护和继续开发快速索引。项目是一个静态单页个人管理系统，核心数据保存在浏览器 `localStorage`，主要由 `index.html`、`app.js`、`styles.css`、`wheel-tool.js`、`wheel-tool.css` 组成。

## 1. 项目入口与文件地图

- `index.html`：页面结构、侧边栏入口、所有弹窗 DOM、基础控件事件绑定。
- `app.js`：主应用逻辑，包含数据结构、记录、待办、习惯、目标、素材库、全局搜索、备份、快照、云同步。
- `styles.css`：主应用样式，包含仪表盘、记录时间轴、待办、习惯、目标、素材库、搜索、快照、云同步、移动端适配。
- `wheel-tool.js`：工具转盘独立逻辑，依赖全局 `data` 和 `saveData`，管理转盘、标签、公共项、抽取历史、转待办。
- `wheel-tool.css`：工具转盘独立样式。
- `docs/knowledge-features.md`：灵感池、素材库、全局搜索的专题说明。
- `docs/project-feature-index.md`：当前总索引文档。
- `docs/environment-workflow.md`：本地 Git、启动、检查、打包和测试数据工作流。
- `scripts/serve.ps1`：本地静态预览脚本。
- `scripts/check.ps1`：基础检查脚本。
- `scripts/package-clean.ps1`：干净交付压缩包脚本。
- `test-data/sample-data.json`：脱敏测试数据。
- `package.json` / `package-lock.json`：Node 项目依赖和测试脚本。
- `playwright.config.js`：Playwright 冒烟测试配置。
- `tests/smoke.spec.js`：核心页面自动化冒烟测试。

## 2. 数据总览

主数据对象在 `app.js` 顶部定义并保存到 `localStorage.lifePlanData`。

- `records`：所有记录，包括日记、计划、复盘、工作记录、灵感碎片等。
- `todos`：全局待办和记录内产生的待办。
- `habits`：习惯规则。
- `checkins`：习惯打卡记录。
- `templates`：用户保存的记录模板。
- `goals`：目标管理数据。
- `deletedItems`：云同步合并使用的删除墓碑。
- `materials`：素材库数据。
- `wheels`：工具转盘配置。
- `wheelTags`：转盘标签。
- `wheelLibraryItems`：转盘公共项。
- `wheelHistory`：转盘抽取历史。

相关维护入口：

- 数据加载：`loadData`
- 数据归一化：`normalizeDataShape`
- 数据保存：`saveData`
- 同步保存：`saveDataFromSync`
- 变更后统一刷新：`renderAfterDataChange`

## 3. 页面与导航

侧边栏通过 `switchPage(pageName, navEl)` 切换页面。

- `dashboard`：首页仪表盘。
- `records`：所有记录。
- `ideas`：灵感池。
- `materials`：素材库。
- `tags`：标签中心。
- `search`：全局搜索。
- `todos`：待办总览。
- `habits`：习惯热力图。
- `goals`：目标管理。
- `wheel`：工具转盘。

页面切换时会按需渲染对应模块。知识类页面的统一刷新入口是 `refreshKnowledgeViews`。

## 4. 首页仪表盘

首页用于当天工作台和快速入口。

- 显示今日日期：`renderTodayDate`
- 汇总今日记录、待办、习惯、目标：`renderDashboardSummary`
- 今日待办：`renderTodayTodos`
- 待办池：`renderFloatingTodos`
- 今日习惯：`renderTodayHabits`
- 今日指挥中心：`renderDashboardCommandCenter`
- 当前周期：`renderActivePeriods`
- 今日时间轴：`renderTimeline`

时间轴数据不是只来自记录，而是由 `buildScheduleItemsForRange` 汇总：

- 记录日程：`buildRecordScheduleItem`
- 待办计划：`buildTodoPlanScheduleItem`
- 待办截止：`buildTodoDueScheduleItem`
- 待办执行记录：`buildTodoSessionScheduleItem`
- 习惯计划：`buildHabitScheduleItem`

首页指挥中心展示未处理灵感、已实践未写结论灵感、高压待办、随机素材复习和进行中目标摘要。

## 5. 记录系统

记录是项目的主线数据，覆盖日记、计划、复盘、工作、灵感等内容。

记录类型入口：

- 日记
- 日计划、周计划、月计划、年度计划、3年计划、终身愿景
- 周复盘、月复盘、年复盘
- 工作记录
- 灵感碎片

核心能力：

- 新建记录：`createRecord`
- 打开编辑：`openRecordModal`
- 记录详情预览：`openRecordPreview`、`renderRecordPreview`
- 当前编辑预览：`previewCurrentRecord`
- 手动保存：`saveRecordManual`
- 自动保存：`scheduleRecordAutoSave`、`persistCurrentRecord`
- 删除记录：`deleteRecord`
- 记录内待办：`addRecordTodo`、`syncRecordTodos`
- 所有记录渲染：`renderAllRecords`
- 列表/日/周/月视图：`setRecordView`、`renderRecordGroups`、`renderAgendaView`、`renderMonthCalendar`

记录日期规则：

- 普通记录使用 `startDate`、`endDate`、`time`、`endTime` 进入时间轴。
- 周/月/年/长期计划会根据类型自动推导建议日期范围：`getSuggestedRangeForType`。
- 日记标题可按日期自动生成：`formatDiaryTitle`、`applyDiaryDefaultTitle`。

## 6. 模板系统

模板用于快速生成结构化记录。

- 内置模板定义：`builtInTemplates`
- 结构化模板编辑器：`renderStructuredTemplateEditor`
- 模板内容组合：`composeTemplateContent`
- 模板内容解析：`parseTemplateContent`
- 应用模板：`applyTemplate`
- 保存当前记录为模板：`saveAsTemplate`
- 模板管理：`openTemplateManage`、`deleteTemplate`

当前内置模板包含日计划、日记、工作记录、灵感捕捉等结构化内容。结构化模板会把分块字段同步到记录正文。

## 7. 灵感池

灵感不是单独集合，而是 `records` 里类型为 `灵感碎片` 的记录，所以一定会出现在所有记录和时间轴里。

灵感字段：

- `ideaStatus`：`待整理`、`待实践`、`实践中`、`已验证`、`已放弃`
- `ideaTags`：灵感标签
- `ideaNextAction`：下一步实践动作
- `ideaTodoId`：关联待办
- `ideaConclusion`：实践结论

核心入口：

- 状态归一：`getIdeaStatus`
- 标签归一：`getIdeaTags`
- 是否未处理：`isIdeaUnprocessed`
- 是否实践后缺结论：`ideaNeedsConclusion`
- 表单字段显示：`updateIdeaFieldsVisibility`
- 表单读写：`setIdeaFormValues`、`getIdeaFormData`
- 灵感筛选：`getFilteredIdeas`
- 灵感统计：`renderIdeaSummary`
- 灵感池渲染：`renderIdeaPool`
- 灵感转待办：`convertIdeaToTodo`
- 灵感筛选跳转：`jumpToIdeas`

当前判定：

- `待整理` 和 `待实践` 算未处理。
- `实践中` 或 `已验证` 但没有结论，算“已实践未写结论”。
- 灵感转待办会优先使用 `ideaNextAction`，其次使用标题或正文，创建待办后写回 `ideaTodoId`。
- 如果灵感已有关联待办，转待办按钮会直接打开已有待办，不重复创建。
- `待整理` 灵感转待办后会自动推进到 `待实践`，其他状态保持不变。

## 8. 素材库

素材库存放金句、AI 提示词、摘抄、观点、方法等可复习内容。

素材字段：

- `id`
- `type`：`金句`、`提示词`、`摘抄`、`观点`、`方法`
- `content`
- `tags`
- `source`
- `note`
- `createdAt`
- `updatedAt`

核心入口：

- 标签聚合：`getAllMaterialTags`
- 筛选素材：`getFilteredMaterials`
- 素材卡片：`renderMaterialCard`
- 标签选择器：`renderMaterialTagPicker`
- 随机抽取：`getRandomMaterials`
- 随机展示：`renderMaterialRandom`
- 页面渲染：`renderMaterialsPage`
- 新增/编辑弹窗：`openMaterialModal`
- 保存素材：`saveMaterial`
- 删除素材：`deleteCurrentMaterial`
- 素材筛选跳转：`jumpToMaterials`

随机展示规则：

- 可勾选多个标签。
- 多标签采用合集匹配并去重。
- 每次总共随机展示 3 条，不是每个标签 3 条。
- 未选择标签时，从全部素材中随机展示。

## 9. 标签中心

标签中心是只读治理视图，暂不做重命名或合并，避免误改历史数据。

覆盖来源：

- 灵感标签：`records` 中 `type === '灵感碎片'` 的 `ideaTags`
- 素材标签：`materials.tags`
- 转盘标签：`wheelTags` 以及 `wheelLibraryItems.tagIds`

核心入口：

- 标签聚合：`getTagCenterItems`
- 标签筛选：`getFilteredTagCenterItems`
- 标签统计：`renderTagCenterSummary`
- 页面渲染：`renderTagCenter`
- 转盘标签跳转：`jumpToWheelTag`

交互规则：

- 可按标签名搜索。
- 可按来源筛选：全部、灵感标签、素材标签、转盘标签。
- 每个标签展示关联灵感数、素材数、转盘公共项数。
- 点击统计卡可跳转到灵感池、素材库或转盘标签面板，并自动带入对应筛选。

## 10. 全局搜索

全局搜索用于跨模块查找内容，也支持按模块搜索。

搜索入口：

- 构建索引：`buildGlobalSearchIndex`
- 判断命中：`matchesGlobalSearch`
- 渲染结果：`renderGlobalSearch`

搜索范围：

- `all`：全部
- `records`：记录
- `todos`：待办
- `goals`：目标
- `materials`：素材库
- `templates`：模板
- `wheel`：转盘公共项

搜索内容覆盖标题、正文、类型、日期、状态、标签、备注、执行记录、子任务、来源、目标描述等字段。结果按模块分组，点击后打开详情或跳转到对应页面。

## 11. 待办系统

待办既可以独立创建，也可以来自记录内待办，还可以由转盘结果转换。

待办字段要点：

- `text`
- `planStartDate`
- `planEndDate`
- `dueDate`
- `urgency`：`urgent`、`high`、`medium`、`low`
- `group`：工作、学习、生活、健康、其他等
- `done`
- `subTodos`
- `sessions`
- `isExclusive`
- `createdAt`、`updatedAt`、`completedAt`

核心入口：

- 待办表格：`renderTodoTable`
- 勾选完成：`toggleTodo`
- 新建待办：`openTodoModal`
- 打开详情：`openTodoDetail`
- 查看/编辑模式切换：`setTodoDetailMode`
- 保存待办：`saveTodoDetail`
- 删除待办：`deleteCurrentTodo`
- 日期快捷项：`applyTodoDatePreset`
- 子任务：`renderSubTodos`、`addSubTodo`
- 执行记录：`renderTodoSessions`、`addTodoSession`、`deleteTodoSession`
- 首页快速执行：`addQuickTodoSession`
- 今日规划：`planTodoForToday`

交互规则：

- 已存在待办默认进入查看模式，避免误编辑。
- 新建待办进入编辑模式。
- 未保存的新待办不能记录“执行一次”。
- 执行记录会进入首页/记录视图的时间轴。

## 12. 习惯系统

习惯用于周期性打卡和热力图统计。

习惯字段要点：

- `name`
- `rule`
- `times`
- `count`
- `tag`
- `goal`
- `noteMode`：`ask`、`always`、`never`

打卡字段要点：

- `habitId`
- `date`
- `time`
- `createdAt`
- `note`

核心入口：

- 习惯标签页：`renderHabitTabs`
- 年度热力图：`renderHeatmap`
- 习惯矩阵：`renderHabitMatrix`
- 习惯统计：`renderHabitStats`
- 新建/编辑习惯：`openHabitModal`、`editCurrentHabit`、`saveHabit`
- 删除习惯：`deleteCurrentHabit`
- 是否应在某天出现：`isHabitDueOnDate`
- 首页快捷打卡：`quickHabitCheckin`
- 快捷备注打卡：`quickHabitCheckinWithNote`
- 撤销/减少打卡：`quickUndoHabitCheckin`、`quickDecreaseHabitCheckin`
- 备注弹窗：`openHabitNoteModal`、`submitHabitNoteModal`

习惯可以进入时间轴，相关入口：

- 添加习惯到时间轴：`addHabitToTimeline`
- 从时间轴移除习惯：`removeHabitFromTimeline`

## 13. 目标管理

目标用于记录长期目标和进度。

目标字段：

- `name`
- `period`
- `status`
- `target`
- `progress`
- `createdAt`
- `updatedAt`

核心入口：

- 新建目标：`openGoalModal`
- 打开目标详情：`openGoalDetail`
- 保存目标：`saveGoal`
- 渲染目标列表：`renderGoalList`
- 删除目标：`deleteGoal`、`deleteCurrentGoal`

目标会参与首页统计和全局搜索。

## 14. 工具转盘

工具转盘逻辑在 `wheel-tool.js`，样式在 `wheel-tool.css`。它复用主应用数据和保存函数。

数据集合：

- `wheels`：转盘配置。
- `wheelTags`：标签。
- `wheelLibraryItems`：公共项。
- `wheelHistory`：抽取历史。

模式：

- 普通转盘：直接从当前转盘项中抽最终结果。
- 标签转盘：先按标签权重抽标签，再从该标签下公共项抽最终结果。

核心入口：

- 初始化种子数据：`ensureSeedData`
- 页面渲染：`renderWheelPage`
- 转盘模式：`setWheelMode`
- 面板切换：`setWheelPanel`
- 选择转盘：`selectWheel`
- 创建/改名/删除转盘：`createWheel`、`renameWheel`、`deleteWheel`
- 普通转盘项：`addWheelItem`、`editWheelItem`、`deleteWheelItem`
- 批量导入普通项：`openWheelBatchImport`
- 公共项：`addWheelLibraryItem`、`editWheelLibraryItem`、`toggleWheelLibraryItem`、`deleteWheelLibraryItem`
- 批量导入公共项：`openWheelLibraryBatchImport`
- 标签：`addWheelTag`、`editWheelTag`、`toggleWheelTagEnabled`、`deleteWheelTag`
- 抽取：`spinWheel`
- 指定标签抽取：`spinDirectTag`
- 历史：`saveHistory`、`renderHistoryPanel`、`deleteWheelHistory`、`clearWheelHistory`
- 转待办：`convertWheelResultToTodo`

转盘公共项也纳入全局搜索。

## 15. 数据备份、快照与云同步

项目已经有完整的数据保护能力，不需要再“从零新增备份”。

手动导出/导入：

- 导出：`exportData`
- 导入：`importData`
- 下载 JSON：`downloadJsonFile`

导出时会先创建本地快照。导入会覆盖当前数据，覆盖前也会创建本地快照。

本地快照：

- 存储键：`lifePlanSnapshots`
- 最大保留：`MAX_LOCAL_SNAPSHOTS = 20`
- 当前快照结构版本：`SNAPSHOT_SCHEMA_VERSION = 2`
- 创建快照：`createLocalSnapshot`
- 快照列表：`renderSnapshotList`
- 快照预览：`renderSnapshotPreview`
- 下载快照：`downloadLocalSnapshot`
- 恢复快照：`restoreLocalSnapshot`
- 删除快照：`deleteLocalSnapshot`

云同步：

- 配置存储：`lifePlanSyncConfig`
- 状态存储：`lifePlanSyncState`
- 配置弹窗：`openSyncSettings`、`saveSyncSettings`
- 测试连接：`testCloudSync`
- WebDAV 请求：`webdavRequest`
- 云端拉取：`syncDownFromCloud`
- 云端上传：`syncUpToCloud`
- 双向同步：`runCloudSync`
- 自动同步调度：`scheduleAutoCloudSync`
- 定时同步：`startPeriodicCloudSync`

同步策略：

- 修改数据后标记 `dirty`，自动同步开启时 20 秒后上传/合并。
- 页面恢复可见时会尝试同步。
- 每 5 分钟检查云端更新。
- 本地和云端都有变化时，先创建快照，再按条目身份和更新时间进行保守合并。
- 删除使用 `deletedItems` 墓碑参与合并，避免被旧云端数据复活。

## 16. 样式与视觉系统

主样式使用 `styles.css` 的 CSS 变量：

- 主色：绿色系 `--accent`
- 背景：柔和浅色、卡片阴影、圆角
- 布局：左侧固定侧边栏，右侧内容区
- 页面动画：`.page` 使用轻微进入动画
- 移动端：`@media (max-width: 980px)` 和 `@media (max-width: 640px)`
- 侧边栏：PC 端导航区独立滚动、底部数据与备份状态保留可见；移动端取消 sticky 悬浮，导航横向滚动，数据与备份默认折叠，折叠标题右侧显示同步摘要。

重点样式区：

- 仪表盘：`.dashboard-hero`、`.today-grid`
- 时间轴：`.timeline-*`、`.record-row`、`.record-time`
- 记录视图：`.record-calendar`、`.agenda-*`、`.record-preview-*`
- 待办：`.todo-*`
- 习惯：`.habit-*`
- 目标：`.goal-*`
- 快照/同步：`.snapshot-*`、`.sync-*`
- 知识模块：`.idea-*`、`.material-*`、`.global-search-*`
- 标签中心和首页指挥中心：`.tag-center-*`、`.command-*`
- 转盘：`wheel-tool.css` 内 `.wheel-*`

## 17. 常见改动索引

新增记录类型：

- 改 `index.html` 的类型选择弹窗。
- 改 `getSuggestedRangeForType` 的日期建议。
- 如需结构化模板，改 `builtInTemplates`。
- 如需筛选项，改所有记录页筛选和 `getFilteredRecords`。

新增灵感状态：

- 改 `IDEA_STATUS_OPTIONS`。
- 改灵感筛选下拉。
- 改 `isIdeaUnprocessed` 或 `ideaNeedsConclusion` 的业务判断。
- 补状态样式和文档。

新增素材类型：

- 改 `MATERIAL_TYPES`。
- 改素材弹窗 `material-type` 选项。
- 确认搜索、随机展示和文档描述。

新增数据集合：

- 在 `data` 初始对象新增集合。
- 在 `normalizeDataShape` 加入默认数组和字段归一化。
- 在导出/导入、快照、云同步合并 `mergeCloudData` 中纳入该集合。
- 如果可搜索，加入 `buildGlobalSearchIndex`。
- 如果可删除并需要云同步，加入 `deletedItems` 墓碑逻辑。

修改待办执行逻辑：

- 重点看 `addTodoSession`、`addQuickTodoSession`、`buildTodoSessionScheduleItem`。
- 注意未保存待办不能执行一次。
- 注意同一待办同一天当前限制只能记录一次执行。

修改时间轴：

- 重点看 `buildScheduleItemsForRange`。
- 每类时间轴项都有单独 builder。
- 样式在 `styles.css` 的时间轴和日程视图区域。

修改转盘：

- 普通/标签模式逻辑在 `wheel-tool.js`。
- 抽取权重由 `weightedPick` 控制。
- Canvas 绘制由 `drawWheelCanvas` 控制。
- 转待办由 `convertWheelResultToTodo` 控制。

## 18. 当前维护注意

- 这是静态前端项目，没有构建系统；`package.json` 只用于 Playwright smoke 测试依赖和脚本。
- 当前项目位置为 `D:\project\life-plan-site`。
- 本地环境工作流见 `docs/environment-workflow.md`。
- 常用检查命令是 `.\scripts\check.ps1`。
- Playwright 测试命令是 `npm test`。
- 干净打包命令是 `.\scripts\package-clean.ps1`。
- 完成一轮可交付功能修改并通过检查后，默认生成干净压缩包并在最终回复提供路径。
- runtime 压缩包默认保留最近 5 个，旧包由 `scripts/package-clean.ps1` 自动清理。
- 数据主要依赖浏览器本地存储，换浏览器或清缓存前应先导出 JSON 或使用云同步。
- `app.js` 文件较大，后续改动建议按功能块小步修改并做浏览器冒烟测试。
- `materials`、灵感字段和转盘集合已经纳入数据归一化、搜索、导出、快照和云同步。
- 交付 runtime 压缩包只包含 `index.html`、`app.js`、`styles.css`、`habit-engine.js`、`habit-ui.js`、`habit-style.css`、`wheel-tool.js`、`wheel-tool.css`。
