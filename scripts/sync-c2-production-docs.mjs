import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content); }
function replaceRequired(path, from, to, minimum = 1) {
  let content = read(path);
  const count = typeof from === 'string'
    ? content.split(from).length - 1
    : [...content.matchAll(new RegExp(from.source, from.flags.includes('g') ? from.flags : `${from.flags}g`))].length;
  if (count < minimum) throw new Error(`${path}: required replacement missing: ${String(from).slice(0, 120)}`);
  content = content.replace(from, to);
  write(path, content);
}
function replaceAll(path, from, to) {
  const content = read(path);
  if (!content.includes(from)) return false;
  write(path, content.split(from).join(to));
  return true;
}
function insertBefore(path, marker, addition, sentinel) {
  let content = read(path);
  if (content.includes(sentinel)) return;
  const index = content.indexOf(marker);
  if (index < 0) throw new Error(`${path}: insertion marker missing: ${marker}`);
  content = `${content.slice(0, index)}${addition}${content.slice(index)}`;
  write(path, content);
}
function appendSection(path, sentinel, section) {
  let content = read(path);
  if (content.includes(sentinel)) return;
  content = `${content.trimEnd()}\n\n${section.trim()}\n`;
  write(path, content);
}

const versionedDocs = [
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];
for (const path of versionedDocs) {
  replaceAll(path, '> 世界状态版本：27', '> 世界状态版本：28');
}
for (const entry of readdirSync('docs')) {
  if (!entry.endsWith('.md')) continue;
  const path = `docs/${entry}`;
  replaceAll(path, '> 市场需求模型版本：18', '> 市场需求模型版本：19');
}

// Persist the actual current world version instead of downgrading it during storage normalization.
{
  const path = 'server/src/storage.js';
  let content = read(path);
  const marker = "    measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecision(world));\n    world.version = 26;\n    return world;";
  if (!content.includes(marker)) throw new Error('server/src/storage.js: final persisted world-version marker missing');
  content = content.replace(marker, "    measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecision(world));\n    world.version = 28;\n    return world;");
  write(path, content);
}

// Carry production-method technology requirements through the typed public catalog.
{
  const path = 'src/types.ts';
  let content = read(path);
  if (!content.includes('requiredTechnologyIds?: string[];')) {
    const marker = "  tone: 'neutral' | 'warning' | 'success' | 'accent';\n  plansByRecipeId: Record<string, FacilityProductionMethodPlan>;";
    if (!content.includes(marker)) throw new Error('src/types.ts: production-method interface marker missing');
    content = content.replace(marker, "  tone: 'neutral' | 'warning' | 'success' | 'accent';\n  requiredTechnologyIds?: string[];\n  plansByRecipeId: Record<string, FacilityProductionMethodPlan>;");
    write(path, content);
  }
}

// Industry authority: catalog, profit rules, dedicated methods, research gates and migrations.
{
  const path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md';
  let content = read(path);
  content = content.replace('> 更新时间：2026-08-12', '> 更新时间：2026-08-13');
  content = content.replace(
    '> 模型 18 C1 投入品平衡规则：36 种商品全部具有直接终端需求，同时继续按正式配方产生逐边派生流动性。原材料和中间品的直接需求代表建设、维修、包装、能源和设备更新，不改变正式配方、生产成本、产量或参考分钟利润。',
    '> 模型 19 C2 作业制度扩展规则：38 种商品全部具有直接终端需求，同时继续按正式配方产生逐边派生流动性。新增工业燃料与工业化学品由炼油厂真实生产，并作为 C2 专属作业制度的周期投入；原材料和中间品的直接需求代表建设、维修、包装、能源和设备更新，不改变正式配方以外的生产结算。',
  );
  content = content.replace('当前基线为 36 种商品和 26 种工厂类型。', '当前基线为 38 种商品和 26 种工厂类型。');
  content = content.replace(
    '- 工厂复杂度同时约束建设门槛、参考分钟利润、生产运营就业结构和世界人口承载权重；C1 基础制度采用工厂级参考分钟利润，农场 0.6、果园 0.9、畜牧场 0.8、渔场 1.0，投入型制度按整件投入和固定现金成本形成新的产出梯度；C2～C7 固定为 3、6、6、8、10、12。复杂度只通过人口承载与岗位结构间接影响消费规模，不直接向市场订单或人口钱包发放货币。',
    '- 工厂复杂度同时约束建设门槛、参考分钟利润、生产运营就业结构和世界人口承载权重；C1 基础制度采用工厂级参考分钟利润，农场 0.6、果园 0.9、畜牧场 0.8、渔场 1.0，投入型制度按整件投入和固定现金成本形成新的产出梯度；C2 基础制度参考分钟利润为 3，辅助、强化、机械化三档固定为 6、9、10.5；C3～C7 基础与通用制度固定为 6、6、8、10、12。复杂度只通过人口承载与岗位结构间接影响消费规模，不直接向市场订单或人口钱包发放货币。',
  );
  content = content.replace(
    '同一 C2～C7 工厂的所有正式配方和通用作业制度必须精确达到该工厂的参考分钟利润。C1 只对基础制度分别锁定农场 0.6、果园 0.9、畜牧场 0.8、渔场 1.0；投入型 C1 制度的投入价值与额外产出由第 9 节固定，不套用通用利润守恒生成器。',
    '同一 C3～C7 工厂的所有正式配方和通用作业制度必须精确达到该工厂的参考分钟利润。C1 只对基础制度分别锁定农场 0.6、果园 0.9、畜牧场 0.8、渔场 1.0；投入型 C1 制度的投入价值与额外产出由第 9 节固定，不套用通用利润守恒生成器。C2 四级制度参考分钟利润固定为 3、6、9、10.5，并按第 9 节的工厂专属整数投入、产出与两位小数现金成本校验，不套用通用利润守恒生成器。',
  );
  content = content.replace(
    '9. 新工厂必须声明 C1～C7 复杂度，施工时间必须落在对应区间，且所有正式配方必须精确达到该工厂的参考分钟利润；C2～C7 继续按复杂度统一，调整现有复杂度时必须同步审查利润、同级工厂及相邻等级的时间递增关系。',
    '9. 新工厂必须声明 C1～C7 复杂度，施工时间必须落在对应区间；C2 专属制度按 3、6、9、10.5 的固定利润梯度校验，C3～C7 继续按复杂度统一，调整现有复杂度时必须同步审查利润、同级工厂及相邻等级的时间递增关系。',
  );

  const plasticLine = '| 塑料 (`plastic`) | 30 | 2 原油 → 1 塑料 | 40 秒 | 8 | 6 |';
  if (!content.includes('工业燃料 (`industrial-fuel`)')) {
    if (!content.includes(plasticLine)) throw new Error(`${path}: plastic table row missing`);
    content = content.replace(plasticLine, `${plasticLine}\n| 工业燃料 (\`industrial-fuel\`) | 4 | 1 原油 → 4 工业燃料 | 60 秒 | 1 | 6 |\n| 工业化学品 (\`industrial-chemicals\`) | 5 | 2 原油 → 6 工业化学品 | 60 秒 | 6 | 6 |`);
  }
  if (!content.includes('炼油厂同时提供塑料、工业燃料和工业化学品三条正式配方')) {
    const marker = '- 化肥厂只有一个正式配方';
    const index = content.indexOf(marker);
    if (index < 0) throw new Error(`${path}: fertilizer rule marker missing`);
    content = `${content.slice(0, index)}- 炼油厂同时提供塑料、工业燃料和工业化学品三条正式配方；工业燃料固定为 1 原油 → 4 工业燃料、60 秒、现金成本 1，工业化学品固定为 2 原油 → 6 工业化学品、60 秒、现金成本 6；三条基础路线均保持 C4 每分钟 6 的参考利润。\n${content.slice(index)}`;
  }
  content = content.replace(
    '原油 ─┬→ 塑料 ──┴→ 电子产品 ──┘\n      └→ 化肥',
    '原油 ─┬→ 塑料 ──┴→ 电子产品 ──┘\n      ├→ 化肥\n      ├→ 工业燃料 → C2 动力／机械化作业制度\n      └→ 工业化学品 → C2 强化／机械化采掘制度',
  );

  const methodsStart = content.indexOf('## 工厂生产方式');
  const c1Heading = content.indexOf('### 9.1 C1 固定作业制度数值');
  if (methodsStart < 0 || c1Heading < methodsStart) throw new Error(`${path}: production method section markers missing`);
  const methodSection = `## 工厂生产方式\n\n- 生产配方决定工厂生产什么，生产方式决定同一配方如何生产；两者都属于同类型工厂集群的共享配置，不属于单座工厂资产。\n- 每种工厂固定提供一个“作业制度”组，且同一时刻只能选择一种。C1 与 C2 使用工厂专属作业制度，内部稳定 ID 统一为 \`standard\`、\`assisted\`、\`intensive\`、\`mechanized\`，玩家名称按工厂产业语义显示；C3～C7 继续使用标准生产、高速生产、节约生产和高产生产。不得新增单座工厂生产方式状态。\n- C1 四种制度不改变同一基础配方的周期和现金周期成本。工具、化肥、拖拉机、配合饲料、养殖药剂和机械均作为配方输入在每周期整件消耗；不累计折旧，不保存耐久度、剩余寿命、设备槽或跨周期摊销。缺少任一整件投入时本周期原子失败，不扣现金、不扣其他投入、不产生部分产出。\n- C2 四种制度保持对应基础配方的周期，但允许改变基础原料批量、追加工具／机械／工业燃料／工业化学品投入、改变产量和现金成本；全部投入仍按每周期整件消耗，不累计折旧。C2 四级制度参考分钟利润固定为 3、6、9、10.5。\n- C1 与 C2 的非基础作业制度必须校验 \`requiredTechnologyIds\`；服务器在 \`setFacilityRecipe\` 权威动作中检查玩家已完成科技，客户端置灰仅用于提示，不构成权限边界。基础制度只要求该工厂自身的准入科技。\n- C3～C7 的标准生产保持正式基础配方；高速生产缩短周期并提高周期成本；节约生产延长周期并降低周期成本；高产生产保持周期、成倍增加正式投入和产出并重新计算周期成本。四种通用方式在商品初始参考价下必须精确保持工厂复杂度对应的参考分钟利润。\n- 服务器正式目录把“基础配方 × 生产方式”编译为不可变的生产方式配方变体。标准方式保留原配方 ID，其他当前方式使用稳定变体 ID；客户端不得自行计算周期、投入、产出或成本。生产方式与配方必须在同一次配置动作中原子切换。\n- 旧 C2 \`rapid\`／\`economical\`／\`high-yield\` 只保留为迁移可识别别名，不向客户端公开且不得主动选择；迁移时必须按旧 ID 前缀恢复到同一基础产物路线的 \`standard\`，不得把铜矿回退成铁矿、把砂糖回退成面粉，也不得执行玩家主动切换时的 2000 基点满员率惩罚。\n- 所有当前变体的周期必须为整秒，投入和产出必须为安全整数，周期成本最多保留两位小数且不得为负；目录验证必须覆盖所有工厂、所有基础配方和全部四种方式。\n\n`;
  content = `${content.slice(0, methodsStart)}${methodSection}${content.slice(c1Heading)}`;

  const c2Sentinel = '### 9.2 C2 固定作业制度数值';
  if (!content.includes(c2Sentinel)) {
    const marker = '生产设置下方不得再显示“周期 · 产出 · 成本”摘要';
    const index = content.indexOf(marker);
    if (index < 0) throw new Error(`${path}: production UI marker missing`);
    const table = `### 9.2 C2 固定作业制度数值\n\nC2 六类工厂不再使用通用高速／节约／高产制度。四级制度保持各自基础配方周期不变，并固定形成 3、6、9、10.5 的参考分钟利润梯度：\n\n| 工厂 | 制度 | 单座每周期投入 | 单座每周期产出 | 周期 | 现金成本 | 参考利润／分 |\n|---|---|---|---:|---:|---:|---:|\n| 伐木场 | 基础采伐 | 无 | 2 木材 | 60 秒 | 9 | 3 |\n| 伐木场 | 锯具采伐 | 1 工具 | 4 木材 | 60 秒 | 6 | 6 |\n| 伐木场 | 动力采伐 | 1 工具 + 1 工业燃料 | 5 木材 | 60 秒 | 5 | 9 |\n| 伐木场 | 机械化采伐 | 1 机械 + 2 工业燃料 | 7 木材 | 60 秒 | 7.95 | 10.5 |\n| 矿场 | 常规开采 | 无 | 2 当前矿物 | 60 秒 | 11 | 3 |\n| 矿场 | 钻具开采 | 1 工具 | 4 当前矿物 | 60 秒 | 10 | 6 |\n| 矿场 | 爆破开采 | 1 工具 + 1 工业化学品 | 5 当前矿物 | 60 秒 | 9 | 9 |\n| 矿场 | 机械化采矿 | 1 机械 + 1 工业化学品 + 1 工业燃料 | 6 当前矿物 | 60 秒 | 6.95 | 10.5 |\n| 油田 | 常规抽采 | 无 | 2 原油 | 60 秒 | 15 | 3 |\n| 油田 | 化学辅助采油 | 1 工业化学品 | 3 原油 | 60 秒 | 16 | 6 |\n| 油田 | 机械增产钻采 | 1 机械 + 1 工业化学品 | 5 原油 | 60 秒 | 15.45 | 9 |\n| 油田 | 动力机械钻采 | 1 机械 + 1 工业化学品 + 1 工业燃料 | 6 原油 | 60 秒 | 18.95 | 10.5 |\n| 磨坊 | 基础加工 | 2 当前原料 | 1 当前产物 | 40 秒 | 8.6 | 3 |\n| 磨坊 | 辊式加工 | 4 当前原料 + 1 工具 | 2 当前产物 | 40 秒 | 5.2 | 6 |\n| 磨坊 | 机械加工 | 6 当前原料 + 1 机械 | 3 当前产物 | 40 秒 | 10.25 | 9 |\n| 磨坊 | 连续化加工 | 6 当前原料 + 1 机械 + 1 工业燃料 | 4 当前产物 | 40 秒 | 18.25 | 10.5 |\n| 锯木厂 | 基础锯切 | 2 木材 | 1 木板 | 40 秒 | 3 | 3 |\n| 锯木厂 | 锯具流水线 | 8 木材 + 1 工具 | 4 木板 | 40 秒 | 4 | 6 |\n| 锯木厂 | 机械制材 | 7 木材 + 1 机械 | 4 木板 | 40 秒 | 4.45 | 9 |\n| 锯木厂 | 动力连续制材 | 8 木材 + 1 机械 + 1 工业燃料 | 5 木板 | 40 秒 | 10.45 | 10.5 |\n| 饲料厂 | 基础配制 | 2 小麦 + 1 水果 | 2 配合饲料 | 60 秒 | 4.9 | 3 |\n| 饲料厂 | 批量配料 | 4 小麦 + 2 水果 + 1 工具 | 5 配合饲料 | 60 秒 | 3.6 | 6 |\n| 饲料厂 | 机械混配 | 6 小麦 + 3 水果 + 1 机械 | 8 配合饲料 | 60 秒 | 10.75 | 9 |\n| 饲料厂 | 动力连续混配 | 8 小麦 + 4 水果 + 1 机械 + 1 工业燃料 | 11 配合饲料 | 60 秒 | 18.95 | 10.5 |\n\n制度研发门槛固定为：伐木场／矿场辅助档需要“工具制造”，强化档需要“工具制造 + 石油炼化”，机械化档需要“机械工程 + 石油炼化”；油田辅助档需要“石油炼化”，强化和机械化档需要“机械工程 + 石油炼化”；磨坊／锯木厂／饲料厂辅助档需要“工具制造”，强化档需要“机械工程”，机械化档需要“机械工程 + 石油炼化”。非基础作业制度必须校验 \`requiredTechnologyIds\`，缺少任一科技时服务器拒绝切换。\n\n`;
    content = `${content.slice(0, index)}${table}${content.slice(index)}`;
  }

  if (!content.includes('世界版本 28／市场需求模型 19')) {
    const marker = '市场需求模型 18 重平衡工具、化肥、拖拉机、配合饲料、养殖药剂和机械。';
    const index = content.indexOf(marker);
    if (index < 0) throw new Error(`${path}: historical model 18 migration marker missing`);
    const migration = `世界版本 28／市场需求模型 19 增加工业燃料与工业化学品、C2 专属作业制度和制度研发门槛。旧存档为两种新增商品补齐零库存、市场与价格传导状态；模型 18 的人口消费与市场储备开放系统订单必须释放真实冻结资金／库存并按模型 19 重建，玩家自己的订单、资金、库存、工厂、合同、拍卖和真实成交历史不得改写。旧 C2 \`rapid\`／\`economical\`／\`high-yield\` 按基础配方 ID 前缀迁回同一产物路线的 \`standard\`；已配置但缺少新制度研发门槛的 C1／C2 高级制度同样回退到对应基础制度。该兼容迁移不得执行主动配置切换的满员率惩罚，不得修改工厂数量、满员率基点或固定点余数。\n\n`;
    content = `${content.slice(0, index)}${migration}${content.slice(index)}`;
  }
  write(path, content);
}

// Design index stays the single authority map.
{
  const path = 'docs/README.md';
  let content = read(path).replace('> 更新时间：2026-08-11', '> 更新时间：2026-08-13');
  content = content.replace(
    '`INDUSTRY_AND_PRODUCTION_DESIGN.md` | 36 种商品、26 种工厂（含 C1 整件工具／化肥／拖拉机与饲料／药剂／机械化作业制度，以及配套饲料、养殖药剂、拖拉机产业支线）',
    '`INDUSTRY_AND_PRODUCTION_DESIGN.md` | 38 种商品、26 种工厂（含 C1 与 C2 工厂专属作业制度、工业燃料／工业化学品，以及配套工具、化肥、饲料、养殖药剂、机械、拖拉机产业支线）',
  );
  if (!content.includes('C2 工厂专属作业制度')) {
    const marker = '## 修改规则';
    const index = content.indexOf(marker);
    if (index < 0) throw new Error(`${path}: modification rules marker missing`);
    content = `${content.slice(0, index)}> C2 工厂专属作业制度、工业燃料／工业化学品、制度研发门槛和旧制度迁移统一归属 \`INDUSTRY_AND_PRODUCTION_DESIGN.md\`；市场需求模型 19 的新增商品直接需求与系统订单重建同步归属产品、订单簿和服务器权威设计。\n\n${content.slice(index)}`;
  }
  write(path, content);
}

// Product, order-book and navigation current-catalog wording.
for (const path of ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', 'docs/UI_DESIGN_SYSTEM.md', 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md']) {
  let content = read(path).replace(/> 更新时间：2026-08-(?:11|12)/, '> 更新时间：2026-08-13');
  content = content.split('当前 36 种正式商品').join('当前 38 种正式商品');
  content = content.split('36 种正式商品').join('38 种正式商品');
  content = content.split('36 种商品和 26 种工厂').join('38 种商品和 26 种工厂');
  content = content.split('36 种商品、26 种工厂').join('38 种商品、26 种工厂');
  write(path, content);
}

appendSection('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '未解锁作业制度保持可见但禁用', `### 生产作业制度研发锁定\n\n生产页继续使用“生产产物／作业制度”双列生产设置。服务器返回的当前作业制度全部进入同一个下拉框；未解锁作业制度保持可见但禁用，并显示缺少的研发科技。玩家选择已解锁制度后立即切换并遵守现有配置重置规则；收起态不显示作业制度说明，展开后只显示方案数据和研发缺口，不创建第二套研发入口。`);

appendSection('docs/UI_DESIGN_SYSTEM.md', '服务器未来返回未知商品 ID', `### 商品与生产方式扩展\n\n当前 38 种正式商品继续由服务器目录动态驱动，商品图片映射覆盖工业燃料与工业化学品；服务器未来返回未知商品 ID 时必须回退到通用商品 SVG，不得导致布局或市场卡片失效。\n\n生产方式下拉选择继续使用共享 \`RichSelectInput\` 的 \`production-config\` 变体和 \`combobox\`／\`listbox\`／\`option\` 语义。未解锁作业制度保持在同一个生产方案槽中并禁用，详情显示所需研发科技；作业制度说明不得显示。不得恢复 \`radiogroup\`、选择卡、按钮组、可见原生 \`select\`，菜单允许宽于触发器，不得复制第二套 Popover、键盘导航或刷新状态。`);

appendSection('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '旧 C2 作业制度', `### C2 作业制度与世界 28 迁移\n\n服务器生产目录继续把基础配方编译为生产方式配方变体；C1 与 C2 的当前制度由工厂专属蓝图生成，C3～C7 保留通用生成器。\`setFacilityRecipe\` 必须先校验工厂准入科技，再校验目标制度的 \`requiredTechnologyIds\`；客户端禁用状态不得替代服务器校验。普通玩家状态中的 \`facilityTypes[].recipes\` 继续只公开标准生产路线，完整当前制度通过 \`productionMethodGroups\` 下发。\n\n旧 C2 作业制度 \`rapid\`／\`economical\`／\`high-yield\` 仅在服务器内部作为迁移别名识别，迁移到同一基础产物路线的标准制度后不再公开或接受主动选择。持久化世界版本固定为 28；市场需求模型 19 对新增工业燃料和工业化学品建立直接需求，并在模型 18 升级时释放并重建人口消费与市场储备系统订单，不改写玩家真实资产和成交历史。`);

// Product/order-book docs need an explicit model-19 catalog statement without rewriting historical migrations.
appendSection('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '模型 19 的 38 种正式商品', `### 模型 19 商品覆盖\n\n市场需求模型版本：19。模型 19 的 38 种正式商品全部具有直接终端需求；工业燃料与工业化学品加入社会消费市场的能源／化工类别，同时继续通过 C2 正式作业制度产生派生需求。模型 18 升级到模型 19 时只重建人口消费与市场储备系统订单，玩家真实资金、库存、开放订单和成交历史保持不变。`);
appendSection('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '模型 19 的系统需求重建', `### 模型 19 系统需求重建\n\n市场需求模型版本：19。模型 19 的系统需求重建只取消并释放人口消费和市场储备拥有的开放订单及其真实冻结资金／库存；玩家开放订单继续保留。新增工业燃料和工业化学品与其余正式商品共用同一商品订单簿、冻结、maker price、手续费、自成交阻断和匿名成交规则。`);

// Root README only summarizes the capability and still delegates parameters to authority docs.
{
  const path = 'README.md';
  let content = read(path);
  content = content.replace(
    '- **产业链经营**：建设工厂、选择配方、配置作业制度，并根据原料、产能和利润调整生产结构。',
    '- **产业链经营**：建设工厂、选择配方、配置作业制度，并根据原料、产能和利润调整生产结构；C1/C2 使用与真实产业投入联动的工厂专属制度。',
  );
  write(path, content);
}

// Current document authority expects the current persisted world version.
{
  const path = 'scripts/verify-document-authority.mjs';
  let content = read(path);
  content = content.split("content.includes('世界状态版本：27')").join("content.includes('世界状态版本：28')");
  content = content.split('世界状态版本必须为 27').join('世界状态版本必须为 28');
  write(path, content);
}

// Any verifier that checks current document metadata must follow the same version header.
for (const entry of readdirSync('scripts')) {
  if (!entry.startsWith('verify-') || !entry.endsWith('.mjs')) continue;
  const path = `scripts/${entry}`;
  let content = read(path);
  const next = content
    .split('世界状态版本：27').join('世界状态版本：28')
    .split('市场需求模型版本：18').join('市场需求模型版本：19');
  if (next !== content) write(path, next);
}

console.log('C2 生产制度权威文档、类型与持久化世界版本已同步。');