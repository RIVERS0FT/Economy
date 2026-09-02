import { readFileSync, writeFileSync } from 'node:fs';

const path = 'docs/UI_DESIGN_SYSTEM.md';
const marker = '## 压缩后共享视觉防回退摘要';
let source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const artworkStart = source.indexOf('### 5.3 商品物资插画图标绘制规范');
const artworkEnd = source.indexOf('\n## 6. 设计令牌、按钮与表单', artworkStart);
if (artworkStart < 0 || artworkEnd < 0) throw new Error('UI 插画章节边界不存在');

const artwork = `### 5.3 商品物资插画图标绘制规范

商品源图保存在 \`src/assets/product-icons/\`，正式页面不得直接加载 \`1024 × 1024\` 源图；构建以预乘 Alpha 生成 \`src/assets/product-icons/generated/128/\` 的 \`128 × 128\` RGBA 缩略图，构建产物不得提交仓库。高密度位置继续使用 SVG，批准的大尺寸商品视觉使用 \`ProductArtwork\`；商品 ID、增删范围和完整资源枚举以服务器目录、源资源与专项 verifier 为准。

### 5.4 工厂场景插画图标绘制规范

正式源资源位于 \`src/assets/facility-icons/\`；高质量写实数字插画／商业级写实 CG，明亮自然的日间环境光。主体建筑或主要设施居中或略居中，通常应占画面宽度约 \`60%–80%\`；核心主体必须落在中央约 \`80%\` 安全区域，天空通常控制在画面高度约 \`20%–30%\`。道路不是必选元素，不得为了统一构图强制加入道路。画面无文字、无人物、无水印、无品牌标志。

当前 C1 复杂度工厂 \`farm\`、\`orchard\`、\`ranch\` 与 \`fishery\`；当前 C2 复杂度工厂 \`logging-camp\`、\`mine\`、\`oil-field\`、\`mill\` 与 \`sawmill\`；当前 C3 复杂度工厂 \`pulp-mill\`、\`steelworks\`、\`textile-mill\`、\`food-factory\` 与 \`paper-mill\`；当前 C4 复杂度工厂 \`refinery\`、\`beverage-factory\`、\`furniture-factory\` 与 \`garment-factory\`；化肥厂当前批准构图以中央造粒塔、双侧储罐、输送管廊和装袋区为核心；\`tool-workshop\` 当前批准构图以砖钢锯齿屋顶工坊、开放锻造间、工作台与工具架为核心；当前 C5 \`machine-factory\`、C6 \`electronics-factory\` 与 C7 \`appliance-factory\`。这些名称只锁定批准视觉基线，正式目录仍以服务器数据为运行事实。

全部批准工厂采用统一新风格从空白新绘，不以旧图为编辑、描摹或重绘底稿，不把旧 C2 图作为图像生成、编辑、构图参考或描摹输入，不把旧 C3–C7 图作为图像生成、编辑、构图参考或描摹输入。\`scripts/facility-artwork-baseline.json\` 保存批准基线，C1–C7 目录、覆盖复杂度与批准源图 SHA-256 基线一致；全部图片都必须在实际 \`4:5\` 居中裁切后保持核心主体完整。

运行时只使用 \`src/assets/facility-icons/generated/256/\`；\`FacilityIcon\` 只按 \`facilityTypeId\` 选择视觉资源，\`prefers-reduced-data\` 回退共享 SVG。建筑卡覆盖完整 \`4:5\` 竖卡；当前工厂详情横幅保持 \`4:5\` 独立插画槽并满幅承载插画，当前工厂详情横幅只在独立插画槽内展示图像，使用 \`background-size: cover\` 与居中定位，并保留上下两层黑色渐变。资源枚举、尺寸、哈希与生成映射由专项 verifier 检查，不在 DESIGN 复制清单。
`;
source = `${source.slice(0, artworkStart)}${artwork}${source.slice(artworkEnd)}`;

const index = source.indexOf(marker);
if (index < 0) throw new Error('UI 压缩摘要不存在');
const summary = `## 压缩后共享视觉防回退摘要

- 列表：一级市场商品目录、全局商品详情与地区市场共享的紧凑商品数据行密度、1:1 商品插画槽。
- 数值：“紧凑数字”是全局固定显示规则；保留完整数字 Tooltip。时长只使用小写 \`s\`、\`m\`、\`h\`；所有排名数值统一通过 \`formatRank\` 显示为 \`#N\`；不得恢复中文“秒／分钟／小时”的玩家时长展示、恢复“第 N 名”或裸数字排名展示；不得重复状态栏已经显示的净资产和排名。
- 头像：状态栏左侧玩家头像；排行榜玩家列固定复用 \`PlayerAvatar\`；必须始终保持 \`1:1\` 正方形；64×64 WebP；\`PlayerAvatar\`、\`CompactNumber\` 继续使用共享入口。
- 输入：\`src/app/interactionBootstrap.ts\`、\`src/styles/interaction-states.css\`、\`scripts/verify-interaction-modality.mjs\`、\`tests/browser/input-modality.spec.ts\`；触摸产生的浏览器粘滞 \`:hover\` 不得改变可见样式；输入方式为 \`keyboard\` 时必须显示明确的 \`:focus-visible\` 焦点。
- 标题：地区商品／工厂详情共享两行标题。
- 工厂列表：插画必须作为真实 Grid 列参与条目尺寸计算；禁止再通过 \`position: absolute\`、\`transform\` 与正文 \`padding-left\` 模拟插画占位；插画区与右侧内容区之间使用弱竖向分隔；第一行数据区与第二行生产区之间只在右侧内容区绘制弱横向分隔；桌面第一行收紧为 \`30px\`；地区工厂列表同步登记为相同的两行高度例外，并与一级工厂目录保持相同的第一行高度与第二行分区层级；约 \`38×38\`、独立插画轨道收紧到约 \`42px\`；\`src/styles/global-facility-narrow.css\` 是该两行条目的最终几何覆盖；验证：\`tests/browser/facility-catalog-layout.spec.ts\`、\`tests/browser/global-operation-pages.spec.ts\`、\`tests/browser/player-page-geometry.spec.ts\`。
- 商品辨识：\`industrial-fuel\`：红色钢制燃料桶与易燃标志；\`industrial-chemicals\`：密封工业化学品桶、实验器皿与分子结构。
`;

writeFileSync(path, `${source.slice(0, index).trim()}\n\n${summary}`, 'utf8');
console.log(`UI_DESIGN_SYSTEM.md => ${Buffer.byteLength(readFileSync(path), 'utf8')} bytes`);
