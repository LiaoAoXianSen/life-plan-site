# 主分支优化 → Vue 分支同步记录

> 用途：记录 `master` 已完成优化在 `migration/vue-app-v1` 的同步状态。Vue 实现按组件、响应式状态和 Pinia/store 架构重写，不机械复制静态版全局函数或 inline handler。

## 状态定义

| 状态 | 含义 |
|---|---|
| 待同步 | master 已完成，Vue 尚未实现 |
| 同步中 | Vue 正在实现 |
| 已同步待验证 | Vue 已实现，等待完整回归/视觉验证 |
| 已完成 | Vue 实现和验收均完成 |

## 同步条目

### [SYNC-20260801-01] 素材标题、标签编辑与长文展示

- 日期：2026-08-01
- 主分支提交：`2abfc65 polish(materials): add titles tags and long-copy disclosure`
- 状态：已同步待验证
- Vue 落点：`src/types/lifePlan.ts`、`src/services/lifePlanRepository.ts`、`src/stores/recordsStore.ts`、`src/pages/MaterialsPage.vue`、`DashboardPage.vue`、`SearchPage.vue`、`TagsPage.vue`

#### 已同步内容

- `materials[]` 非破坏性新增 `title: string`；旧数据加载时归一为空字符串，正文、标签、来源和备注不丢失。
- 展示标题优先使用独立标题；空标题回退正文首个非空行并限制为 42 字符摘要。
- 编辑器可勾选已有标签、输入一个或多个新标签，新标签即时加入草稿，保存时统一去重为 `string[]`。
- 素材卡片默认显示标题和正文摘要，长文支持展开/收起；详情弹窗只读展示全文并可进入编辑。
- `material=<id>` 深链接改为打开只读详情；搜索结果、首页随机素材和标签中心统一使用标题/摘要策略。
- Vue 插值渲染恶意标题/内容，不使用 `v-html`；XSS 回归验证未生成注入元素。

#### 验收

- [x] 旧素材无 `title` 仍有可读标题且数据字段完整
- [x] 标签草稿、已有标签勾选、新标签加入和保存去重通过聚焦回归
- [x] 摘要、展开/收起、详情全文和详情进入编辑通过聚焦回归
- [x] 搜索、首页和标签中心已切换到新标题/摘要契约
- [x] 恶意正文按文本渲染，不执行 HTML
- [ ] 完整 Vue smoke 与 375/390px 布局检查

### [SYNC-20260802-01] 转盘公共项文本与标签组合筛选

- 日期：2026-08-02
- 主分支提交：`888c0bf feat(wheel): filter library items by text`
- 状态：已同步待验证
- Vue 落点：`src/pages/WheelPage.vue`、`src/stores/wheelStore.ts`

#### 已同步内容

- 公共项管理新增会话态文本筛选，同时匹配 `name` 和可选 `note`，忽略首尾/连续空白和英文大小写。
- 文本与标签按 AND 组合，任一筛选可独立清空；筛选状态不写入 `lifePlanData` 或同步配置。
- 显示“当前结果/全部公共项”计数和清除筛选操作。
- 全选仅作用于当前组合筛选可见项；跨筛选已选 ID 继续保留并显示当前可见计数。
- 公共项表单补齐 `note` 编辑，确保备注筛选字段可以在 Vue 内维护。

#### 验收

- [x] 名称文本筛选和仅备注命中通过聚焦回归
- [x] 标签 + 文本 AND 组合通过聚焦回归
- [x] 清空筛选和跨筛选选择计数通过聚焦回归
- [x] 筛选操作保持 `lifePlanData` 字节不变
- [ ] 完整 Vue smoke 与窄屏布局检查

### [SYNC-20260802-02] 公共项标签自定义下拉

- 日期：2026-08-02
- 主分支提交：`a840982` / `87a6d68 fix(wheel): restore layout and refine tag dropdown`
- 状态：已同步待验证
- Vue 落点：`src/pages/WheelPage.vue`

#### 已同步内容

- 原生筛选 `<select>` 改为 Vue 响应式自定义下拉，展示标签颜色点、当前值、选中态和勾选。
- 使用 `role="listbox"` / `role="option"`、`aria-expanded` 和 `aria-selected`。
- 支持外部点击、Escape、ArrowUp/ArrowDown、Home/End、Enter/Space。
- 桌面下拉就近展开；700px 以下改为底部浮层，避免管理区域裁切和横向溢出。

#### 验收

- [x] 鼠标选择与外部关闭逻辑完成
- [x] 方向键、Home/End、Enter 和 Escape 行为完成
- [x] 聚焦回归验证键盘选择与筛选结果
- [ ] 完整 Vue smoke 与窄屏布局检查
