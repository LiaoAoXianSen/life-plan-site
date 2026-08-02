# 主分支优化 → Vue 分支同步记录

> 用途：主分支（`master`）继续优化期间的同步台账。每完成一项主分支优化，就在这里追加一条记录，供后续 `migration/vue-app-v1` 按 Vue 架构逐项实现。
>
> 重要：这里记录的是“主分支已完成、Vue 待同步”的事实，不代表 Vue 分支已经同步完成。

## 工作约定

- 主分支优化只在 `master` 进行；不覆盖、不回退 Vue 分支正在处理的本地改动。
- 每条记录对应一个独立、可验收的优化切片，不把无关改动合并成一个同步项。
- Vue 同步时不要机械复制静态版代码；根据记录中的目标页面、交互、数据契约和验收条件重新落到 Vue 组件、store/composable 与样式中。
- 纯视觉改动也要记录视觉规则，不只记录文件名或提交号。
- 主分支完成后，记录状态固定为 `待同步`，直到 Vue 分支实际完成并验证后再更新状态。

## 状态定义

| 状态 | 含义 |
|---|---|
| 待同步 | 主分支已完成，Vue 尚未实现或尚未开始验证 |
| 同步中 | Vue 分支正在按记录实现 |
| 已同步待验证 | Vue 已实现，仍需对照主分支完成浏览器/回归验证 |
| 已完成 | Vue 实现和验收均已完成 |

## 记录模板

复制以下区块追加到“同步条目”末尾：

```md
### [SYNC-YYYYMMDD-序号] 优化名称

- 日期：YYYY-MM-DD
- 主分支提交：`<commit-sha> <commit-subject>`
- 状态：待同步
- 主分支范围：`<页面 / 功能 / 视觉主题>`

#### 用户可见变化

- <变化 1>
- <变化 2>

#### 主分支实现定位

- 文件：`<path>`
- 逻辑：`<函数 / 事件 / 数据处理>`；无逻辑改动时填写“无”
- 样式：`<选择器 / token / 响应式规则>`
- 测试：`<测试文件与用例>`

#### Vue 同步落点

- 页面/组件：`<Vue page / component>`
- 状态/数据：`<store / composable / adapter>`；无改动时填写“无”
- 样式：`<对应 scoped style / module / token>`
- 不要直接照搬：<静态版实现中 Vue 不应机械复制的部分>

#### 数据与交互契约

- 数据结构：<无变化，或列出字段/默认值/兼容要求>
- 交互规则：<点击、筛选、保存、删除、确认、错误状态等>
- 响应式要求：<桌面、平板、手机的验收要求>

#### 验收条件

- [ ] <主分支可见效果在 Vue 中一致>
- [ ] <关键交互与边界状态通过>
- [ ] <数据兼容/回归测试通过>
- [ ] <桌面与移动端检查通过>
```

## 同步条目

<!-- 后续每完成一项 master 优化，在此追加一条完整记录。 -->

### [SYNC-20260801-01] 素材标题、标签编辑与全站长文案治理

- 日期：2026-08-01
- 主分支提交：`2abfc65 polish(materials): add titles tags and long-copy disclosure`
- 状态：待同步
- 主分支范围：素材库数据/创建编辑/卡片/详情/搜索，以及首页、记录、待办、目标、习惯、健身、转盘管理列表的长文案展示

#### 用户可见变化

- 素材新增独立标题；旧素材没有 `title` 时按正文首行/前 42 个字符显示回退标题。
- 创建和编辑素材时可勾选已有标签，也可现场创建新标签或用逗号批量输入；保存后统一去重为 `tags: string[]`。
- 素材卡片默认收起长标题、正文、来源和备注，可内联展开/收起，也可打开只读详情查看完整内容；详情可继续进入编辑。
- 素材随机展示、首页随机素材、标签中心和全局搜索统一使用素材标题与摘要策略。
- 首页待办、记录/灵感、目标、习惯快捷卡、健身卡片、搜索结果和转盘管理列表中的长文案改为 1–3 行摘要，已有详情/编辑态继续显示全文。

#### 主分支实现定位

- 文件：`app.js`、`index.html`、`fitness-ui.js`、`wheel-tool.js`；`scripts/package-clean.ps1` 已补充拆分后的 `styles/` 运行目录
- 逻辑：`normalizePreviewText`、`truncateTextPreview`、`getMaterialTitle`、`renderMaterialCard`、`toggleMaterialCard`、`renderMaterialEditorTags`、`addMaterialEditorTag`、`openMaterialDetail`、`saveMaterial`、`buildGlobalSearchIndex`
- 样式：`styles/pages/library.css`、`styles/pages/dashboard.css`、`styles/pages/records.css`、`styles/pages/todos.css`、`styles/pages/goals.css`、`styles/pages/habits.css`、`styles/responsive.css`、`fitness-style.css`、`wheel-tool.css`
- 测试：`tests/smoke.spec.js` 中素材标题/标签/展开详情、旧数据兼容、375px 窄屏和恶意 ID/XSS 回归；主分支完整检查 76/76 通过

#### Vue 同步落点

- 页面/组件：素材页、素材卡片、素材详情弹窗、素材编辑弹窗、首页随机素材卡；首页待办/目标卡、记录卡、习惯快捷卡、健身卡和转盘管理行
- 状态/数据：素材 store/composable 的 `title` 归一化、`getMaterialTitle` 回退、编辑临时标签集合、保存时 tags 去重；现有同步/导入 contract 保持非破坏性新增字段
- 样式：共享 `TextClamp`/摘要 class 或各 Vue 卡片的 scoped style；桌面 1–3 行限制、375px 单列和无横向溢出
- 不要直接照搬：静态版的 inline `onclick` 和全局函数；Vue 应使用组件事件、props/emits、响应式选中标签状态和对话框组件

#### 数据与交互契约

- 数据结构：素材新增可选字符串 `title`；旧数据允许无字段或空字符串。`content/source/note` 不截断保存，`tags` 继续是字符串数组，不引入 tag ID 或独立素材标签表。
- 交互规则：编辑时勾选已有标签；新增标签立即进入当前选中集合；取消不写数据；保存合并并去重；卡片展开只改本地展示状态；详情全文只读并可进入编辑；全局搜索点击素材打开详情。
- 响应式要求：桌面卡片网格高度稳定；移动端单列、标签换行、按钮可点击、弹窗可滚动且页面无横向溢出。

#### 验收条件

- [ ] 旧素材无 `title` 仍显示可读标题且不丢正文、标签、来源、备注
- [ ] 新建/编辑可勾选已有标签并现场创建新标签，保存后去重
- [ ] 素材默认摘要、展开/收起、详情全文、详情进入编辑均可用
- [ ] 各列表态长文案不会撑坏卡片或横向溢出，详情/编辑态仍显示全文
- [ ] 恶意标题、标签、内容、来源、备注和带引号 ID 不执行脚本
- [ ] 桌面与 375px 移动端视觉和回归测试通过

### [SYNC-20260802-01] 转盘公共项文本与标签组合筛选

- 日期：2026-08-02
- 主分支提交：`888c0bf feat(wheel): filter library items by text`
- 状态：待同步
- 主分支范围：工具转盘 → 管理 → 公共项库

#### 用户可见变化

- 在现有“标签筛选”旁增加“文本筛选”，输入时即时更新公共项列表。
- 文本同时匹配公共项名称和备注，忽略首尾空白、连续空白和英文大小写。
- 标签与文本使用 AND 组合：只有同时满足选中标签和搜索文本的公共项才显示。
- 清空文本后保留当前标签筛选；清空标签后保留文本筛选结果。
- 全选与批量操作只作用于组合筛选后的可见项，跨筛选勾选总数继续保留并正确提示。

#### 主分支实现定位

- 文件：`wheel-tool.js`、`wheel-tool.css`
- 逻辑：`wheelLibraryTextFilter`、`getFilteredLibraryItemsForManage`、`hasWheelLibraryManageFilter`、`renderWheelLibraryRows`、`refreshWheelLibraryFilterResults`、`setWheelLibraryTextFilter`
- 样式：`.wheel-library-filter-group`、`.wheel-library-text-search` 和既有 `.wheel-library-toolbar` 移动端单列规则
- 测试：`tests/smoke.spec.js` 的 `wheel library copy is tag-filtered and history can be exported`

#### Vue 同步落点

- 页面/组件：Vue 工具转盘公共项库管理组件的筛选工具栏和公共项列表
- 状态/数据：组件内新增会话态文本关键词，不写入 `lifePlanData`、远端快照或同步配置
- 样式：标签下拉与文本搜索并排，窄屏改为单列；沿用现有筛选控件视觉
- 不要直接照搬：静态版全局函数和 `oninput`；Vue 使用响应式 computed 对 `wheelLibraryItems` 做标签 + 文本组合过滤

#### 数据与交互契约

- 数据结构：无变化；文本条件读取 `wheelLibraryItems[*].name` 与可选 `note`
- 交互规则：标签条件 AND 文本包含条件；输入仅局部刷新列表，不打断焦点或中文输入；批量选择基于当前组合筛选结果
- 响应式要求：桌面筛选器并排，移动端单列且输入框不横向溢出

#### 验收条件

- [ ] 仅文本筛选可按名称命中
- [ ] 仅存在于备注的关键词也可命中
- [ ] 标签与文本同时启用时只显示共同命中项
- [ ] 清空任一筛选不会清除另一筛选
- [ ] 组合筛选下全选、跨筛选计数和批量操作范围正确
- [ ] 桌面与移动端无溢出，回归测试通过
