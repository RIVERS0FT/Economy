# Economy CI 执行设计

## 1. 权威入口

- `.github/workflows/ci.yml` 负责 PR 合入验证和手动完整验证；不为普通分支 push 默认重复执行同等 CI。`.github/workflows/deploy.yml` 负责 `main` 自动部署与完整生产门禁。
- 改动文件影响范围唯一由 `scripts/select-ci-tests.mjs` 计算。DT、IT、ST 只消费同一份选择计划，不得各自复制第二套 changed-file 或领域选择规则。
- `pull_request` 使用事件提供的真实 base/head 计算改动；`workflow_dispatch` 执行完整验证。合并依据实际检查结果，不要求另一条 push CI 的登记记录，也不对 required 工作流设置路径忽略。
- GitHub Actions 中针对生产环境的手动诊断工作流只负责执行受控只读检查；生产 SQLite 的持久化、维护、备份、恢复与服务运行边界仍归 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`。

## 2. DT、IT、ST 分层

### 2.1 DT（Development Test）

DT 负责快速证明单模块、静态结构和纯逻辑正确，不依赖完整浏览器用户链路。DT 包含：

- `scripts/verify-*.mjs` 防回退与架构检查；
- 服务器语法检查、TypeScript typecheck、正式 Vite build 与 Nginx 配置测试；
- `tests/dt/*.test.ts` 中不依赖浏览器的客户端／共享纯逻辑测试；
- DT 代码覆盖率门禁。

纯前端源码发生变化时，targeted 计划必须执行 DT 覆盖率；直接修改 DT 测试时也必须执行同一覆盖率入口。DT 不得通过模拟浏览器 DOM 来替代应由 ST 验证的真实交互。

### 2.2 IT（Integration Test）

IT 负责证明服务器模块在真实事务、SQLite、状态投影、幂等与跨领域协作下能够组合工作。现有 `server/test/*.test.js` 是正式 IT 测试集合；测试可使用 `EconomyStore(':memory:')`，但必须保留正式事务、世界状态和领域实现，不得用重新实现的假业务逻辑替代。

Targeted 模式必须由选择器挑出与改动相关的 IT 文件，并通过统一覆盖率执行器运行；full 模式执行完整 `server/test/*.test.js`。服务端源码若无法归入任何领域且没有任何 verifier、IT 或 ST 引用，必须回退 full，而不是静默跳过验证。

### 2.3 ST（System Test）

ST 负责从完整系统或真实用户输入角度验证运行行为：

- `tests/browser/*.spec.ts` 的 Playwright 浏览器测试属于 ST-browser；
- `tests/stress` 与正式压力场景属于 ST-performance；
- `scripts/verify-production-deployment.sh` 的远端与公网检查属于 ST-production acceptance。

PR 只在选择器判定需要浏览器验证时执行 ST-browser；手动完整验证执行全部 ST-browser；`main` 部署前始终执行完整 ST-browser。实际压力场景不要求每个普通 PR 执行，但其 harness、账户隔离和测试流必须继续受静态 verifier 保护。

## 3. 代码覆盖率门禁

覆盖率使用仓库固定 Node 24 自带的 `node:test` V8 coverage，不新增第三方覆盖率服务或依赖。覆盖率只是一道补充门禁，不能替代业务断言、IT 事务验证或 ST 浏览器测试。

### 3.1 DT 覆盖范围

当前 DT 覆盖以下客户端纯逻辑模块：

- `src/app/adaptivePolling.js`；
- `src/app/immediateCommandIntent.ts`；
- `src/app/revisionGate.js`；
- `src/utils/assetAllocation.ts`；
- `src/utils/virtualListRange.ts`。

当前 DT 最低覆盖率为：

- Lines ≥ 95%；
- Functions ≥ 95%；
- Branches ≥ 90%。

新增进入 DT 覆盖范围的纯逻辑模块时，必须在同一修改中新增或扩展 `tests/dt` 并更新唯一覆盖率执行器；不得仅扩大分母而不补断言，也不得为了提高数字把已有适合 DT 的模块从 include 中删除。

### 3.2 IT 覆盖范围

IT 覆盖已由选中服务器测试实际加载的 `server/src/**/*.js`、`server/shared/**/*.js` 与 `shared/**/*.js`。Node 24 不会把从未加载的文件自动计为零覆盖，因此关键权威模块必须同时由 `scripts/verify-code-coverage.mjs` 锁定源码和对应 IT 基线存在，避免通过完全不加载关键模块制造虚高覆盖率。

IT 覆盖率执行器不得使用 `--test-coverage-include` 强制把未加载的服务器源码按零覆盖加入分母；targeted 与 full 都只统计本次 IT 实际加载的正式代码，并排除测试文件本身。关键模块是否具备 IT 基线继续由 `scripts/verify-code-coverage.mjs` 静态锁定，不能用扩大分母替代测试选择正确性。

当前 IT 最低覆盖率为：

- Lines ≥ 60%；
- Functions ≥ 55%；
- Branches ≥ 50%。

关键权威经济模块包括运行时动作执行、运行时存储、经济 mutation、订单簿、生产结算、银行、拍卖与状态分区。覆盖率低于门槛必须补测试或修正实现，不得删除覆盖率参数、降低断言、排除关键源文件或仅在 CI 中关闭门禁。

### 3.3 覆盖率产物

覆盖率结果以测试输出和失败日志为准。`coverage/`、`.nyc_output/` 或其他可再生成报告不得提交到 `main`；CI 失败时可以上传短期日志 Artifact，成功运行不长期保存覆盖率产物。

## 4. PR 与手动执行拓扑

PR 与手动 CI 当前按以下依赖执行：

1. `dt` Job 计算一次 changed-file 计划并执行 DT；
2. `it` Job 复用 `dt` 输出的同一计划并执行 IT；
3. 若计划要求 ST-browser，`browser-test` 在 DT 与 IT 成功后启动四个独立 shard；
4. 最终 `build` 聚合 Job 只做门禁汇总，不重新执行构建或测试。

主分支 Ruleset 所要求的稳定状态上下文继续使用 `build`。因此 `build` 聚合 Job 只有在本次所需 DT、IT 和 ST 全部成功后才能成功；浏览器 ST 不需要执行时允许 `browser-test` 为 skipped。这样 required check 名称保持稳定，同时避免出现“DT 成功但 ST 失败仍可合并”的旧漏洞。

Targeted 模式中，`dt`、`it`、`browser-test` 必须消费 `scripts/select-ci-tests.mjs` 生成的同一 JSON 计划。不得在后续 Job 重新计算 changed files、重新推断领域或自行扩缩测试集合。

部署验收基础设施文件即使文件名包含 `production`，也只属于 CI／部署路径，不得因此归入 gameplay `facility` 域。`scripts/verify-production-deployment.sh`、正式域名验收专项 verifier 与其行为测试只通过直接文件／引用关系选择对应 DT；仅修改这些部署验收基础设施时不得凭文件名扩散到工厂 IT 或 ST-browser。选择器本身仍属于 high-risk full trigger，修改该边界时必须回退完整 DT、完整 IT 与完整 ST-browser。

## 5. 浏览器门禁与执行配置

- 当前 ST-browser 使用四个独立 shard、`fail-fast: false` 与每个 Job 20 分钟上限。分片数量、并发拓扑与合理超时是可据运行数据调整的配置，不是永久禁令；调整必须保持选中集合完整、分片分母一致、失败可诊断和总耗时有界。
- `browser-test` 必须等待 DT 与 IT 成功，避免静态或事务失败后继续消耗浏览器运行器。
- targeted 模式把同一组已选 Playwright spec 交给全部配置 shard，并通过 `--shard=N/总数` 确定性分配；不得漏跑分片、删除相关基线或另建手工测试清单。
- full fallback 模式同样使用配置的全部分片覆盖完整 Playwright 集合，与 `main` 部署前的完整浏览器门禁保持同一执行模型。
- targeted 浏览器 runner 通过 `ECONOMY_PLAYWRIGHT_SHARD=N/总数` 控制 Playwright 分片；该变量只允许控制分片，不得改变选择器计划本身。

## 6. main 部署门禁

`main` 的部署工作流继续保留独立 `build` 与 `browser-test`：

- 部署 `build` 通过 `npm run build` 执行完整 DT、完整 DT coverage、完整 IT 与完整 IT coverage；
- 部署 `browser-test` 四分片执行完整 ST-browser；
- `deploy` 只有在上述两类验证都成功后才允许上传和切换生产版本；
- 部署完成后继续运行 ST-production acceptance，验证服务健康、正式域名、公网入口、账号／注册／游戏 API 与数据库只读完整性边界。
- 正式域名的公网页面、健康 API 与游戏 API 必须继续通过真实 `game.riversoft.top` DNS 与 HTTPS 验证，不得使用 `--resolve`、`--connect-to` 或固定 Host/IP 绕过公网 DNS。仅当 `curl` 未获得任何 HTTP 状态（`000`，包括瞬时 DNS／传输失败）时允许最多 3 次、间隔 1 秒的有界重试，单次连接超时 2 秒、总耗时 3 秒；一旦正式域名返回非预期 HTTP 状态必须立即失败，不得重试掩盖应用／代理错误。该重试不得改变 `ECONOMY_DEPLOY_VERIFY_START` 后 45 秒真实健康检查门槛。

部署 build 在完整验证通过后打包其正式 `dist`，通过同一次工作流的短期 Artifact 交给 deploy。产物 ID、源码 SHA 和归档 SHA-256 由成功 build 的 Job 输出传递；deploy 在解包前校验源码 SHA 与独立传递的摘要，任何缺失或不匹配均失败。不得下载其他运行／仓库的产物，不依赖下载 Action 仅告警的摘要提示代替硬校验。按产物 ID 下载可在仅重跑失败 deploy 时复用原成功 build 的产物；产物过期则重新执行完整发布验证。

部署 Job 不再重新生成美术／预览资源或执行 TypeScript、Vite、完整 build 或 Playwright；只消费已验证产物并保留原有服务器发布、生产安全边界与线上验收。短期产物不提交仓库。

## 7. 失败、运行时 Harness 与超时

- 浏览器行为回归应根据证据修复根因；可以依据正常负载与运行数据调整合理超时，但不得用延时、吞错、降低断言或跳过必要测试来掩盖失败。同一失败且没有新证据时应报告阻塞，不盲目重跑。
- 单个 Playwright test 不得把可独立重建状态的多个完整页面层级串成长链直到消耗默认单测超时。此类回归必须按独立用户阶段拆分为多个 test，并在每个 test 中从同一确定性 fixture 重建前置状态，同时保留原有断言。
- 同一几何基线需要覆盖三个以上完整视口并且每个视口都会重新加载 runtime／preview fixture 时，必须在测试声明期按视口生成独立 Playwright test，使每个视口拥有独立默认单测预算；不得在单个 test 内循环多个完整 reload，也不得因此删减任何视口或几何断言。
- `player-page-geometry.spec.ts` 的全页面承载宽度基线必须按“视口 × 页面”在测试声明期生成独立 test；市场图表的完整 runtime／根字号阶段也必须各自独立。跨宽度相对关系只能在单一 runtime 内通过真实 resize 与权威 `data-*` 状态轮询比较。
- 交互激活态的浏览器门禁必须先等待权威 DOM 状态提交，再使用 `expect.poll` 条件轮询读取 computed style；不得用固定 sleep 猜测渲染提交时机，也不得通过删除颜色、边框或背景断言绕过视觉状态验证。
- 每个 shard 的失败日志、Playwright report 与 test results 使用独立 Artifact 名称，避免并行 Job 互相覆盖；成功运行不长期上传测试 Artifact。
- 透明 Top Layer、Portal、Popover 等共享浮层变更必须至少保留一个真实浏览器命中测试，证明浮层打开时无关底层控件仍可正常 click/hover/tap，而不能只检查 CSS 字符串或计算样式。
- 使用正式 `SignedInShell`／工作区浮层的专用 runtime harness 必须加载与正式应用一致的共享安全浮层样式。`src/styles/frosted-glass-chrome.css` 是这些 harness 的唯一共享外壳聚合入口，并必须包含 `safe-floating.css`；不得在各测试 HTML 中复制 Tooltip Layer 的定位或 `pointer-events` 规则。

## 8. 生产数据库只读诊断执行

- 生产数据库只读诊断工作流固定为 `.github/workflows/diagnose-production-database.yml`，只允许由 `workflow_dispatch` 人工触发并使用最小只读仓库权限；不得把诊断嵌入普通 CI、自动部署或定时写维护流程。
- 诊断脚本连接正式 SQLite 时必须同时使用 SQLite URI `mode=ro`、`PRAGMA query_only = ON` 和 authorizer 三重只读约束；任一层缺失都不得视为可安全执行的生产诊断。
- 只读诊断不得执行 `VACUUM`、`wal_checkpoint`、`PRAGMA optimize`、备份、附加数据库、DDL 或 DML，也不得停止、重启或改变生产服务；诊断前后数据库、WAL 与 SHM 必须保持不变。
- 诊断不得上传数据库、WAL、SHM、备份或包含玩家明细的 Artifact；只允许把无身份的容量、空闲页、完整性和 SQLite 对象聚合结果写入 Job Summary。

## 9. 必须保护的结果

不得恢复以下行为：

- 把 DT、IT 和 ST 重新混成一个无法区分失败层级的单一 PR Job；
- 在 IT 或 ST Job 中重新计算 changed files 或建立第二套领域选择规则；
- 让主分支 required `build` 在所需 ST-browser 失败、取消或未完成时成功；
- 删除 DT／IT 覆盖率阈值、降低阈值或把关键源码从范围中移除以绕过失败；
- 在 IT 覆盖率中恢复 `--test-coverage-include`，把 targeted 模式没有加载的服务器源码按零覆盖计入分母；
- 把部署验收基础设施文件仅因名称含 `production` 重新归入 gameplay `facility` 域，进而无依据扩大到工厂 IT／ST-browser；选择器边界本身发生变化时不得取消 full fallback。
- 把 selected/full 浏览器测试重新串行放回 DT 或 IT Job；
- 改变浏览器分片或超时配置时漏跑选中集合、失去有限失败边界，或以配置调整掩盖行为错误；
- targeted shard 自行重新定义测试集合；
- 把可独立重建 fixture 的多阶段页面回归重新合并成长链，或用提高 Playwright 单测超时替代阶段拆分；
- 把三个以上需要完整 reload 的视口重新串进同一个 Playwright test，共享一份默认单测预算；
- 在权威 DOM 状态切换后立即一次性读取 computed style，或用固定 sleep／删除视觉断言替代 `expect.poll` 条件等待；
- 只依赖静态 `pointer-events` 检查而删除真实浏览器输入穿透回归；
- 让 SignedInShell runtime harness 绕过共享外壳聚合入口或缺少 `safe-floating.css`，再用测试专用 CSS 伪造 Tooltip Layer 几何；
- 把正式域名公网验收改成单次无重试 DNS 请求、把传输失败当成功，或用 `--resolve`／`--connect-to` 绕过真实 DNS；正式域名返回非预期 HTTP 状态时不得继续重试。
- 把生产数据库诊断改成自动触发、可写连接、维护操作或服务控制入口；
- 为诊断上传数据库文件、WAL/SHM、备份或玩家级明细 Artifact。

## 10. 文档与验证职责

Markdown 路径本身不表示业务源码变更。纯文档计划只执行仓库文本格式及文档结构／本地链接检查，不安装业务依赖，也不因文件名包含 market、production、map 等词或正文引用而扩散到 IT/ST。混合变更仍验证文档，但领域与引用推断仅使用非文档路径。选择器、文档验证器、共享协议、发布流程和无法分类的源码保持 full fallback。

路径分类不能判断文字是否改变契约。业务语义、安全要求或接口契约改变时，应在同一变更中提供相应实现／行为测试；无法由路径体现的影响使用手动完整验证，不把文档计划当作语义审查豁免。

文档验证不锁定自然语言措辞、章节标题、文档字节数或第二份手工清单；结构契约与职责路由见 `README.md`。覆盖率与业务安全断言保持现有门槛。本轮规则和 CI 基础设施修改必须运行完整回归，不能通过新的减负路径自我豁免。

`tests/dt/project-governance.test.ts` 用临时文档目录、选择计划和实际工作流 shell 验证文案可改写、登记／链接错误仍失败、文档不扩大业务测试、必要检查失败不放行及错误部署产物不能解包；不使用固定设计句子代替行为断言。

工作流依赖与分片完整性统一由 `scripts/verify-deployment-pipeline.mjs` 验证；`scripts/verify-runtime-reliability.mjs` 只保留运行环境准备、失败诊断及自身运行时边界，不另建第二份 CI 拓扑或设计文案清单。目录 README 与普通 Markdown 先按文档分类，不能仅因位于 `src`、`shared` 或工作流目录而当成可执行基础设施；混合变更仍按非文档路径判断影响。
