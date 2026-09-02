import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
const save = (path, content) => writeFileSync(resolve(root, path), `${content.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');

function appendOnce(path, marker, text) {
  const source = read(path);
  if (source.includes(marker)) return;
  save(path, `${source.trim()}\n\n${text.trim()}\n`);
}

function replaceExact(path, before, after) {
  const source = read(path);
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${path} 缺少待替换片段`);
  save(path, source.replace(before, after));
}

appendOnce('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '## 压缩后关键运行与部署不变量', `
## 压缩后关键运行与部署不变量

以下条目只保留服务器领域必须长期稳定的边界；具体模块清单仍以代码为运行事实。

- 资产拍卖追加式审计由 \`auction-audit-store.js\` 承担；即时建厂缺料采购由 \`facility-auto-procure.js\` 承担；玩家卖出手续费由 \`market-sell-fee.js\` 落实；人口需求实现包含 \`population-economy.js\`。这些文件名只作为实现与验证映射，不创建第二套业务规则。
- 地区化每日商品合同继续通过统一合同门面执行，合同时间单位统一为天；邮箱验证码有效期为 10 分钟，错误 5 次即失效，并核对发送 IP 和提交 IP。\`RESEND_API_KEY\` 与 \`EMAIL_FROM\` 只保存在服务器；共享 \`/etc/riversoft-email.env\` 先加载，Economy 专用 \`/etc/riversoft-economy-api.env\` 后加载。未配置时返回“邮箱验证码服务未配置，请联系管理员”。发送前通过 \`POST /api/internal/account-email-exists\` 检查统一账号；已注册邮箱不得创建 \`economy_email_verifications\` 记录，也不得发送邮件。
- 验证码记录清理、验证码创建／状态更新和完成前校验只写注册专用 SQLite 表，不得触发世界到期调度 barrier；最终创建 Economy 玩家档案继续属于普通用户世界写入。已有 \`economy_registrations\` 且永久邀请码元数据完整的 \`/api/game/session\` 直接走只读会话；仅缺元数据时使用 \`system:session-metadata:*\`，真正建档使用 \`session-profile-creation\`。验证码终态记录保留 30 天。
- 正式 SQLite 必须保持 \`auto_vacuum=INCREMENTAL\`；普通玩家事务不得执行 \`incremental_vacuum\`。每周一北京时间 02:30 执行受限维护，每批固定 1,024 页、单次最多四批。迁移备份使用紧凑 gzip SQLite 快照并通过 \`VACUUM INTO\` 消除 freelist；解压后的 \`auto_vacuum\` 必须保持 \`INCREMENTAL\`。最多保留最近 5 个迁移族，迁移工作空间至少为预计有效数据两倍再加 512 MiB，删除临时 SQLite 前显式关闭全部连接。Windows 本地行为验证与 Linux 正式部署共用同一实现，分段存储 V2 首次迁移前必须创建 \`economy-pre-storage-v2\`。
- API 代码继续使用 \`rsync --delete-before\` 完整替换，同步 \`server/\` 时必须排除 \`runtime/\`。固定 Node runtime 完全匹配时必须复用且不得重新下载或上传；正式运行时固定 Node 24.4.0。旧哈希资源至少保留 400 天，发布时最后原子替换 \`index.html\`。
- CI 必须验证真实头提交，而不是 GitHub 合并快照；\`verify-head-ci-registration\` 只确认真实 push 检查存在，不得写入 commit status，不保留第二个重复的 PR Web Build 工作流，也不得用手工成功状态替代任一真实检查。
- 部署 SSH 主机密钥不得依赖单次 \`ssh-keyscan\`，最多尝试 5 次；连接验证失败必须在数据库备份、文件上传和服务变更之前终止。成功步骤日志不得上传；失败摘要使用 \`economy-failure-summary.txt\`，禁止重新扫描或拼接成功步骤日志，不得再为单次构建失败创建临时诊断工作流。生产验收同时包含发布前远端验收和发布后公网验收，\`ECONOMY_DEPLOY_VERIFY_START\` 之后的 45 秒真实健康检查门槛保持不变。
- 压力测试继续报告 p50／p90／p95／p99，并验证高负载不会突破请求超时和事件循环容量边界。
`);

appendOnce('docs/UI_DESIGN_SYSTEM.md', '## 压缩后共享视觉防回退摘要', `
## 压缩后共享视觉防回退摘要

- 一级市场商品目录、全局商品详情与地区市场共享的紧凑商品数据行密度、1:1 商品插画槽；正负数值仍使用共享实体列表语义。
- “紧凑数字”是全局固定显示规则，完整数字 Tooltip 必须保留；时长只使用小写 \`s\`、\`m\`、\`h\`，所有排名数值统一通过 \`formatRank\` 显示为 \`#N\`，不得恢复中文“秒／分钟／小时”的玩家时长展示，也不得恢复“第 N 名”或裸数字排名展示；页面不得重复状态栏已经显示的净资产和排名。
- \`PlayerAvatar\` 用于状态栏左侧玩家头像和排行榜玩家列；排行榜玩家列固定复用 \`PlayerAvatar\`，头像必须始终保持 \`1:1\` 正方形，上传展示基线为 64×64 WebP。\`CompactNumber\` 与完整数字 Tooltip 继续复用共享格式化入口。
- 输入方式实现与验证映射为 \`src/app/interactionBootstrap.ts\`、\`src/styles/interaction-states.css\`、\`scripts/verify-interaction-modality.mjs\` 与 \`tests/browser/input-modality.spec.ts\`。触摸产生的浏览器粘滞 \`:hover\` 不得改变可见样式；输入方式为 \`keyboard\` 时必须显示明确的 \`:focus-visible\` 焦点。
- 地区商品／工厂详情共享两行标题，并继续由共享标题组件处理地区导航和省略规则。
- 工厂目录两行列表的几何 owner 在 UI：插画必须作为真实 Grid 列参与条目尺寸计算，禁止再通过 \`position: absolute\`、\`transform\` 与正文 \`padding-left\` 模拟插画占位；插画区与右侧内容区之间使用弱竖向分隔，第一行数据区与第二行生产区之间只在右侧内容区绘制弱横向分隔。桌面第一行收紧为 \`30px\`；地区工厂列表同步登记为相同的两行高度例外，并与一级工厂目录保持相同的第一行高度与第二行分区层级。极窄载体插画约 \`38×38\`、独立插画轨道收紧到约 \`42px\`。实现与验证映射为 \`src/styles/global-facility-narrow.css\`、\`tests/browser/facility-catalog-layout.spec.ts\`、\`tests/browser/global-operation-pages.spec.ts\` 与 \`tests/browser/player-page-geometry.spec.ts\`。
- 工厂场景插画图标绘制规范继续以 \`src/assets/facility-icons/\` 为源。当前 C1 复杂度工厂 \`farm\`、\`orchard\`、\`ranch\` 与 \`fishery\`；当前 C2 复杂度工厂 \`logging-camp\`、\`mine\`、\`oil-field\`、\`mill\` 与 \`sawmill\`；当前 C3 复杂度工厂 \`pulp-mill\`、\`steelworks\`、\`textile-mill\`、\`food-factory\` 与 \`paper-mill\`；当前 C4 复杂度工厂 \`refinery\`、\`beverage-factory\`、\`furniture-factory\` 与 \`garment-factory\`；当前 C5 \`machine-factory\`、C6 \`electronics-factory\` 与 C7 \`appliance-factory\`。所有批准工厂采用统一新风格从空白新绘，不以旧图为编辑、描摹或重绘底稿，不把旧 C2 图作为图像生成、编辑、构图参考或描摹输入，也不把旧 C3–C7 图作为图像生成、编辑、构图参考或描摹输入。
- 工厂运行时缩略图位于 \`src/assets/facility-icons/generated/256/\`；\`FacilityIcon\` 只按 \`facilityTypeId\` 选择视觉资源。低数据模式保留 \`prefers-reduced-data\` 回退。工厂卡插画覆盖完整 \`4:5\` 竖卡；当前工厂详情横幅保持 \`4:5\` 独立插画槽并满幅承载插画，当前工厂详情横幅只在独立插画槽内展示图像，使用 \`background-size: cover\` 与居中定位。
- 商品辨识中 \`industrial-fuel\`：红色钢制燃料桶与易燃标志；\`industrial-chemicals\`：密封工业化学品桶、实验器皿与分子结构。
`);

appendOnce('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '## 压缩后页面防回退摘要', `
## 压缩后页面防回退摘要

- 一级建筑只提供工厂类型全局总览与工厂优先地区钻取；开发入口 \`all-pages-preview.html\` 只用于本地完整游戏预览，不成为正式页面或导航。
- 移动底栏可显示拍卖角标、合同角标和排行榜结算提醒；玩家侧栏不显示按钮数字角标。拍卖角标必须区分被超价、新增和已读，拍卖页不得渲染最近结束或历史结算区域，桌面结构保持左列“发起拍卖”、右列“正在进行的拍卖”。
- 通知入口位于状态栏最右侧；普通通知只保留最近 20 条。面板关闭后保持历史，待处理事项不能删除；概览不得再维护第二套经营提醒列表。同一稳定待处理键持续存在期间不得重复生成提醒，玩家可禁用主动通知提醒。
- 战略追踪器属于外壳常驻信息区；页面只消费其结果，不创建第二套追踪器。
`);

appendOnce('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md', '## 5. 压缩后场景防回退补充', `
## 5. 压缩后场景防回退补充

- 所有玩家 \`PageLayout\` 标题统一使用 \`design-system.css\` 的 \`--player-page-title-track-height: 40px\`；普通单行标题统一使用 \`--font-size-player-page-title\`。
- 移动端工厂卡点击行为与桌面一致，继续进入同一地区建筑二级详情。
- 建设卡和工厂详情都保持普通文档流，不使用建筑页场景 sticky，也不建立第二纵向滚动根。
`);

appendOnce('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', '正式目录必须按 `complexity` 从 `C1` 到 `C7` 升序排列', `
- 正式目录必须按 \`complexity\` 从 \`C1\` 到 \`C7\` 升序排列；同复杂度仍保持服务器目录声明顺序。
- 工厂目录交互必须保持键盘焦点仍保持可见；具体焦点视觉由 \`UI_DESIGN_SYSTEM.md\` 负责。
`);

appendOnce('docs/MARKET_CHART_LAYOUT_DESIGN.md', '市场行情图几何、交互与可读性唯一专项基线', `
本文是市场行情图几何、交互与可读性唯一专项基线；数据生成和撮合价格仍归市场业务设计。
`);

appendOnce('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件', `
## 压缩后认证入口防回退补充

未登录外壳固定以登录主面板作为默认入口；注册子面板和密码重置子面板只从登录主面板进入。“忘记密码”和“注册账号”必须位于密码输入框下方。邮箱已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件。
`);

appendOnce('docs/LIQUID_GLASS_CHROME_DESIGN.md', '## 压缩后工作区层级防回退摘要', `
## 压缩后工作区层级防回退摘要

- 通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上；通知面板打开期间不得挂载通知岛。移动底栏在根 Sheet 存在时继续保持同一 DOM，但必须隐藏并退出交互树。
- 战略追踪器与页面路由生命周期解耦，不得提供整体横向展开／收起按钮；六个 \`fullscreen\` 页面在桌面端隐藏同一追踪器 DOM，离开后恢复同一实例。
`);

replaceExact('scripts/verify-email-registration.mjs', `for (const text of [
  '| 商店 | \`gem-shop\` | \`GemShopPage\` | 邀请获取宝石、礼品码兑换与每日终端动态报价兑换普通货币 |',
  '| 设置 | \`settings\` | \`SettingsPage\` | 资料、偏好、教程控制、存档管理和退出 |',
  '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件',
  '未登录外壳固定以登录主面板作为默认入口',
  '注册子面板',
  '密码重置子面板',
  '“忘记密码”和“注册账号”必须位于密码输入框下方',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);`, `for (const text of [
  '| 商店 | \`gem-shop\` | \`GemShopPage\` | 邀请获取宝石、礼品码兑换与每日终端动态报价兑换普通货币 |',
  '| 设置 | \`settings\` | \`SettingsPage\` | 资料、偏好、教程控制、存档管理和退出 |',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件',
  '未登录外壳固定以登录主面板作为默认入口',
  '注册子面板',
  '密码重置子面板',
  '“忘记密码”和“注册账号”必须位于密码输入框下方',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);`);

replaceExact('scripts/verify-facility-artwork.mjs', `[paths.catalogDesign, catalogDesign, ['\`FacilityIcon\` 只按 \`facilityTypeId\` 选择视觉资源']],`, `[paths.uiDesign, uiDesign, ['\`FacilityIcon\` 只按 \`facilityTypeId\` 选择视觉资源']],`);

replaceExact('scripts/verify-facility-catalog-layout.mjs', `design: 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',`, `design: 'docs/UI_DESIGN_SYSTEM.md',`);

const pageContentPath = 'scripts/verify-page-content.mjs';
let pageContent = read(pageContentPath);
pageContent = pageContent.replace(/for \(const text of \[\n\s*'一级“建筑”全局页只保留全局工厂目录'[\s\S]*?\]\) requireText\('docs\/FACILITY_CATALOG_PRESENTATION_DESIGN\.md', text\);\n/, `for (const text of [
  '正式目录必须按 \`complexity\` 从 \`C1\` 到 \`C7\` 升序排列',
  '只过滤、不二次排序',
]) requireText('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', text);\n`);
save(pageContentPath, pageContent);

replaceExact('scripts/verify-mobile-page-sheet.mjs', `requireAll('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上',
  '通知面板打开期间不得挂载通知岛',
  '移动底栏在根 Sheet 存在时继续保持同一 DOM，但必须隐藏并退出交互树',
]);`, `requireAll('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上',
  '通知面板打开期间不得挂载通知岛',
  '移动底栏在根 Sheet 存在时继续保持同一 DOM，但必须隐藏并退出交互树',
]);`);

replaceExact('scripts/verify-player-avatar.mjs', `requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '状态栏左侧玩家头像',
  '排行榜玩家列固定复用 \`PlayerAvatar\`',
  '必须始终保持 \`1:1\` 正方形',
  '64×64 WebP',
]);`, `requireText('docs/UI_DESIGN_SYSTEM.md', [
  '状态栏左侧玩家头像',
  '排行榜玩家列固定复用 \`PlayerAvatar\`',
  '必须始终保持 \`1:1\` 正方形',
  '64×64 WebP',
]);`);

replaceExact('scripts/verify-display-format.mjs', `requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '只使用小写 \`s\`、\`m\`、\`h\`',
  '所有排名数值统一通过 \`formatRank\` 显示为 \`#N\`',
  '恢复中文“秒／分钟／小时”的玩家时长展示',
  '恢复“第 N 名”或裸数字排名展示',
  '不得重复状态栏已经显示的净资产和排名',
]);`, `requireText('docs/UI_DESIGN_SYSTEM.md', [
  '只使用小写 \`s\`、\`m\`、\`h\`',
  '所有排名数值统一通过 \`formatRank\` 显示为 \`#N\`',
  '恢复中文“秒／分钟／小时”的玩家时长展示',
  '恢复“第 N 名”或裸数字排名展示',
  '不得重复状态栏已经显示的净资产和排名',
]);`);

const strategicPath = 'scripts/verify-strategic-outliner.mjs';
let strategic = read(strategicPath);
strategic = strategic
  .replace(`requireText(pageDesign, '页面路由生命周期解耦', '页面权威设计必须锁定追踪器与页面生命周期解耦');`, `requireText(chromeDesign, '页面路由生命周期解耦', '外壳权威设计必须锁定追踪器与页面生命周期解耦');`)
  .replace(`requireText(pageDesign, '不得提供整体横向展开／收起按钮', '页面权威设计必须锁定无整体横向收起按钮');`, `requireText(chromeDesign, '不得提供整体横向展开／收起按钮', '外壳权威设计必须锁定无整体横向收起按钮');`)
  .replace(`requireText(pageDesign, '六个 \`fullscreen\` 页面在桌面端隐藏同一追踪器 DOM', '页面权威设计必须锁定 fullscreen 隐藏同一追踪器 DOM');`, `requireText(chromeDesign, '六个 \`fullscreen\` 页面在桌面端隐藏同一追踪器 DOM', '外壳权威设计必须锁定 fullscreen 隐藏同一追踪器 DOM');`);
save(strategicPath, strategic);

console.log('design verifier ownership fixes applied');
