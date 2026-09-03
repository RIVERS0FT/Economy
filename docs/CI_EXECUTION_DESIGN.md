# Economy CI 执行设计

## 1. 权威入口

- `.github/workflows/ci.yml` 是 PR 与非 `main` push 的唯一 CI 工作流；`.github/workflows/deploy.yml` 是 `main` 自动部署与完整生产门禁。
- 改动文件影响范围仍唯一由 `scripts/select-ci-tests.mjs` 计算。CI 分片只改变已选测试的执行并行度，不得扩大、缩小或复制第二套领域选择规则。
- `pull_request` 与非 `main` push 继续按各自真实 base/head 或 merge-base 计算改动，并保留 `verify-head-ci-registration` 对同一 PR head push CI 的只读登记校验。
- GitHub Actions 中针对生产环境的手动诊断工作流只负责执行受控只读检查；生产 SQLite 的持久化、维护、备份、恢复与服务运行边界仍归 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`。

## 2. PR 与分支浏览器门禁

- 只要选择器要求浏览器验证，PR 与非 `main` push 的浏览器硬门禁固定拆成四个独立 shard，使用 `fail-fast: false`，每个 shard 保留 20 分钟 Job 上限。
- `build` Job 只执行依赖安装、静态/服务器检查、TypeScript、Vite 与完整 fallback build，不得再把浏览器回归串行塞进同一个 20 分钟 Job。
- `browser-test` Job 必须 `needs: build`。只有 build 成功且选择器要求浏览器验证时才启动四分片，避免静态失败后继续消耗浏览器运行器。
- targeted 模式必须把选择器已经确定的同一组 Playwright spec 交给四个 shard，并通过 Playwright `--shard=N/4` 做确定性分配；不得为了缩短时间删除同领域基线、只跑首个 shard 或另建手工测试清单。
- full fallback 模式同样使用四分片覆盖完整 Playwright 集合，与 `main` 部署前的完整浏览器门禁保持同一执行模型。
- targeted 浏览器 runner 通过 `ECONOMY_PLAYWRIGHT_SHARD=N/4` 把分片参数交给 `scripts/select-ci-tests.mjs run --phase browser`；该变量只允许控制 Playwright 分片，不得改变选择器计划本身。

## 3. 失败、运行时 Harness 与超时

- 浏览器行为回归必须修复实际根因；不得通过提高 Job 超时、扩大 Playwright 单测超时、关闭 retry、降低断言或跳过浏览器门禁来掩盖失败。
- 单个 Playwright test 不得把可独立重建状态的多个完整页面层级串成长链直到消耗默认单测超时。此类回归必须按独立用户阶段拆分为多个 test，并在每个 test 中从同一确定性 fixture 重建前置状态，同时保留原有断言；例如市场信息层级固定分为“全局商品目录”“商品地区列表”“地区商品详情”三个独立浏览器阶段，禁止通过延长 30 秒单测预算维持单体长链。
- 同一几何基线需要覆盖三个以上完整视口并且每个视口都会重新加载 runtime／preview fixture 时，必须在测试声明期按视口生成独立 Playwright test，使每个视口拥有独立默认单测预算；不得在单个 test 内循环多个完整 reload，也不得因此删减任何视口或几何断言。
- 交互激活态的浏览器门禁必须先等待权威 DOM 状态（例如 `class`、`aria-*` 或 `data-*`）提交，再使用 `expect.poll` 条件轮询读取 computed style；不得用固定 sleep 猜测渲染提交时机，也不得通过删除颜色、边框或背景断言绕过视觉状态验证。
- 每个 shard 的失败日志、Playwright report 与 test results 使用独立 Artifact 名称，避免并行 Job 互相覆盖；成功运行不长期上传测试 Artifact。
- 透明 Top Layer、Portal、Popover 等共享浮层变更必须至少保留一个真实浏览器命中测试，证明浮层打开时无关底层控件仍可正常 click/hover/tap，而不能只检查 CSS 字符串或计算样式。
- 使用正式 `SignedInShell`／工作区浮层的专用 runtime harness 必须加载与正式应用一致的共享安全浮层样式。`src/styles/frosted-glass-chrome.css` 是这些 harness 的唯一共享外壳聚合入口，并必须包含 `safe-floating.css`；不得在各测试 HTML 中复制 Tooltip Layer 的定位或 `pointer-events` 规则。这样测试到的是正式宿主几何，而不是缺失生产 CSS 后的静态空块。

## 4. 生产数据库只读诊断执行

- 生产数据库只读诊断工作流固定为 `.github/workflows/diagnose-production-database.yml`，只允许由 `workflow_dispatch` 人工触发并使用最小只读仓库权限；不得把诊断嵌入普通 CI、自动部署或定时写维护流程。
- 诊断脚本连接正式 SQLite 时必须同时使用 SQLite URI `mode=ro`、`PRAGMA query_only = ON` 和 authorizer 三重只读约束；任一层缺失都不得视为可安全执行的生产诊断。
- 只读诊断不得执行 `VACUUM`、`wal_checkpoint`、`PRAGMA optimize`、备份、附加数据库、DDL 或 DML，也不得停止、重启或改变生产服务；诊断前后数据库、WAL 与 SHM 必须保持不变。
- 诊断不得上传数据库、WAL、SHM、备份或包含玩家明细的 Artifact；只允许把无身份的容量、空闲页、完整性和 SQLite 对象聚合结果写入 Job Summary。非显然原因是诊断本身不能改变待观察的 WAL/freelist 证据，也不能借故障排查扩大生产数据暴露面。

## 5. 防回退

不得恢复以下行为：

- 把 selected/full 浏览器测试重新串行放回 build Job；
- PR/分支需要浏览器验证时只使用单个 2-worker Job 执行全部选中测试；
- 用延长 20 分钟上限替代四分片；
- targeted shard 自行重新定义测试集合；
- 把可独立重建 fixture 的多阶段页面回归重新合并成逼近默认单测超时的单体长链，或用提高 Playwright 单测超时替代阶段拆分；
- 把三个以上需要完整 reload 的视口重新串进同一个 Playwright test，共享一份默认单测预算；
- 在权威 DOM 状态切换后立即一次性读取 computed style，或用固定 sleep／删除视觉断言替代 `expect.poll` 条件等待；
- 只依赖静态 `pointer-events` 检查而删除真实浏览器输入穿透回归；
- 让 SignedInShell runtime harness 绕过共享外壳聚合入口或缺少 `safe-floating.css`，再用测试专用 CSS 伪造 Tooltip Layer 几何；
- 把生产数据库诊断改成自动触发、可写连接、维护操作或服务控制入口；
- 为诊断上传数据库文件、WAL/SHM、备份或玩家级明细 Artifact。
