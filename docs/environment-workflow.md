# 环境工作流

本文档记录当前项目的本地协作约定，避免后续每次重新摸索环境。

## 项目位置

当前项目根目录：

```text
D:\project\life-plan-site
```

项目已经初始化本地 Git 仓库。当前约定是只做本地 Git 操作，不配置远程仓库，不推送。

## 常用命令

在项目根目录执行：

```powershell
.\scripts\serve.ps1
```

启动本地预览，默认地址：

```text
http://localhost:5173/
```

如需指定端口：

```powershell
.\scripts\serve.ps1 8080
```

执行基础检查：

```powershell
.\scripts\check.ps1
```

该脚本会检查 `app.js`、`wheel-tool.js`、`playwright.config.js` 的 JavaScript 语法，运行 Playwright 冒烟测试，并显示 Git 工作区状态。

直接运行 Playwright 冒烟测试：

```powershell
npm test
```

有界面模式运行：

```powershell
npm run test:headed
```

生成干净交付压缩包：

```powershell
.\scripts\package-clean.ps1
```

默认只保留最近 5 个 `life-plan-site-clean-*.zip`，生成新包后会自动删除更旧的包。需要临时调整保留数量时，可以传入数字：

```powershell
.\scripts\package-clean.ps1 8
```

压缩包会排除：

- `.git`
- `ai-memory`
- `docs`
- 已有 `*.zip`
- 常见缓存、临时和构建目录

交付约定：

- 每次完成一轮可交付功能修改并通过检查后，默认运行 `.\scripts\package-clean.ps1` 生成新的干净压缩包。
- 压缩包保留最近 5 个，避免项目目录长期堆积历史包。
- 用户不需要每次单独提醒“打包”。
- 如果只是解释问题、查看代码、轻微文档调整或未形成可交付版本，可以不打包。
- 最终回复里应给出新压缩包路径。

## Git 约定

- 每轮修改前先看 `git status --short`。
- 修改完成后跑 `.\scripts\check.ps1`。
- 确认无误后做本地提交。
- 不自动添加 remote。
- 不执行 `git push`，除非用户明确要求并提供远程仓库策略。

## Playwright

项目本地安装了 Node.js 版 Playwright：

```text
@playwright/test
```

Chromium 浏览器文件安装在当前 Windows 用户的 Playwright 缓存目录中，例如：

```text
C:\Users\lihao\AppData\Local\ms-playwright
```

当前冒烟测试在：

```text
tests\smoke.spec.js
```

测试会自动启动本地静态服务，打开首页，检查核心页面导航，并对全局搜索做基础输入验证。

## 测试数据

脱敏测试数据在：

```text
test-data\sample-data.json
```

它包含记录、灵感、待办、习惯、目标、素材库和转盘样例。需要做真实场景验证时，可以在页面中使用“导入恢复”导入该文件。

注意：导入会覆盖浏览器当前数据。导入前应先导出当前真实数据或创建本地快照。

## 数据安全

项目已有三类数据保护能力：

- 导出备份
- 本地快照
- 云同步

代码压缩包只是项目文件备份，不等于浏览器里的个人数据备份。改大功能前优先在页面里创建快照或导出 JSON。

## 后续维护入口

功能总索引：

```text
docs\project-feature-index.md
```

知识功能专题：

```text
docs\knowledge-features.md
```

后续修改前，优先阅读总索引文档定位对应功能块。
