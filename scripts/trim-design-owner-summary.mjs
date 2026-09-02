import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/UI_DESIGN_SYSTEM.md';
const marker = '## 压缩后共享视觉防回退摘要';
const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const index = source.indexOf(marker);
if (index < 0) throw new Error('UI 压缩摘要不存在');

const summary = `## 压缩后共享视觉防回退摘要

- 列表：一级市场商品目录、全局商品详情与地区市场共享的紧凑商品数据行密度、1:1 商品插画槽。
- 数值：“紧凑数字”是全局固定显示规则；保留完整数字 Tooltip。时长只使用小写 \`s\`、\`m\`、\`h\`；所有排名数值统一通过 \`formatRank\` 显示为 \`#N\`；不得恢复中文“秒／分钟／小时”的玩家时长展示、恢复“第 N 名”或裸数字排名展示；不得重复状态栏已经显示的净资产和排名。
- 头像：状态栏左侧玩家头像；排行榜玩家列固定复用 \`PlayerAvatar\`；必须始终保持 \`1:1\` 正方形；64×64 WebP；\`PlayerAvatar\`、\`CompactNumber\` 继续使用共享入口。
- 输入：\`src/app/interactionBootstrap.ts\`、\`src/styles/interaction-states.css\`、\`scripts/verify-interaction-modality.mjs\`、\`tests/browser/input-modality.spec.ts\`；触摸产生的浏览器粘滞 \`:hover\` 不得改变可见样式；输入方式为 \`keyboard\` 时必须显示明确的 \`:focus-visible\` 焦点。
- 标题：地区商品／工厂详情共享两行标题。
- 工厂列表：插画必须作为真实 Grid 列参与条目尺寸计算；禁止再通过 \`position: absolute\`、\`transform\` 与正文 \`padding-left\` 模拟插画占位；插画区与右侧内容区之间使用弱竖向分隔；第一行数据区与第二行生产区之间只在右侧内容区绘制弱横向分隔；桌面第一行收紧为 \`30px\`；地区工厂列表同步登记为相同的两行高度例外，并与一级工厂目录保持相同的第一行高度与第二行分区层级；约 \`38×38\`、独立插画轨道收紧到约 \`42px\`；\`src/styles/global-facility-narrow.css\` 是该两行条目的最终几何覆盖；验证：\`tests/browser/facility-catalog-layout.spec.ts\`、\`tests/browser/global-operation-pages.spec.ts\`、\`tests/browser/player-page-geometry.spec.ts\`。
- 工厂插画：工厂场景插画图标绘制规范；\`src/assets/facility-icons/\`。当前 C1 复杂度工厂 \`farm\`、\`orchard\`、\`ranch\` 与 \`fishery\`；当前 C2 复杂度工厂 \`logging-camp\`、\`mine\`、\`oil-field\`、\`mill\` 与 \`sawmill\`；当前 C3 复杂度工厂 \`pulp-mill\`、\`steelworks\`、\`textile-mill\`、\`food-factory\` 与 \`paper-mill\`；当前 C4 复杂度工厂 \`refinery\`、\`beverage-factory\`、\`furniture-factory\` 与 \`garment-factory\`；当前 C5 \`machine-factory\`、C6 \`electronics-factory\` 与 C7 \`appliance-factory\`。采用统一新风格从空白新绘；不以旧图为编辑、描摹或重绘底稿；不把旧 C2 图作为图像生成、编辑、构图参考或描摹输入；不把旧 C3–C7 图作为图像生成、编辑、构图参考或描摹输入。运行时：\`src/assets/facility-icons/generated/256/\`；\`FacilityIcon\` 只按 \`facilityTypeId\` 选择视觉资源；\`prefers-reduced-data\`；覆盖完整 \`4:5\` 竖卡；当前工厂详情横幅保持 \`4:5\` 独立插画槽并满幅承载插画；当前工厂详情横幅只在独立插画槽内展示图像；\`background-size: cover\` 与居中定位。
- 商品辨识：\`industrial-fuel\`：红色钢制燃料桶与易燃标志；\`industrial-chemicals\`：密封工业化学品桶、实验器皿与分子结构。
`;

writeFileSync(path, `${source.slice(0, index).trim()}\n\n${summary}`, 'utf8');
console.log(`UI_DESIGN_SYSTEM.md => ${Buffer.byteLength(readFileSync(path), 'utf8')} bytes`);
