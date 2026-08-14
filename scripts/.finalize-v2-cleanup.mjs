import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

function appendAfter(path, marker, addition) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(addition.trim())) return;
  if (!source.includes(marker)) throw new Error(`${path}: finalization marker not found`);
  source = source.replace(marker, `${marker}\n\n${addition.trim()}`);
  writeFileSync(path, source);
}

appendAfter(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'V2 热保存不得做完整世界 `isDeepStrictEqual`、完整世界 `JSON.stringify` 或全世界资金精度扫描。保存层只序列化 Mutation Scope 覆盖的玩家与 segment，与 committed segmented snapshot 比较并形成 Dirty Set；没有 Dirty Row 时世界修订号保持不变。写入成功后草稿直接成为新的 committed world，未变玩家和 segment 的 SQLite 行内容及 `updated_revision` 必须保持原值。',
  `玩家 V2 持久化行不得保存仅用于旧客户端展示的 \`trades\`、\`ledger\`、\`assetEvents\` 或旧 \`facilities\` 实例日志。Copy-on-Write 动作必须把这些字段视为可缺省展示数据：写动作不得因为字段不存在而失败，也不得为了兼容旧展示结构重新把它们写回玩家行；历史审计继续由各自独立追加式 SQLite 表承担。\n\n失败动作、重复操作或其他无业务状态变化的动作可以保存精简幂等确认，但不得仅因兼容规范化、空数组补全、\`lastProcessedAt\` 更新时间或其他派生容器初始化而产生 Dirty Row、写回世界或推进全局 \`revision\`。这类结构迁移只允许发生在冷加载、旧单行世界迁移或明确世界版本升级。合同历史冷启动导入必须优先读取 V2 分段世界；只有尚未建立 V2 元数据时才允许回退读取旧 \`economy_world.state_json\`。`,
);

const verifierPath = 'scripts/verify-authoritative-hotpaths.mjs';
let verifier = readFileSync(verifierPath, 'utf8');
if (!verifier.includes("const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');")) {
  verifier = verifier.replace(
    "const design = read('docs/README.md');\n",
    "const design = read('docs/README.md');\nconst serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');\n",
  );
  verifier = verifier.replace(
    "console.log('权威热路径验证通过：按领域截止时间推进、分段存储 V2、Copy-on-Write 动作草稿、Dirty Row 持久化、纯只读状态投影、统一订单簿与六分区客户端权威状态均受防回退约束。');",
    `for (const text of [\n  '玩家 V2 持久化行不得保存仅用于旧客户端展示的',\n  '失败动作、重复操作或其他无业务状态变化的动作',\n  '不得仅因兼容规范化、空数组补全',\n  '合同历史冷启动导入必须优先读取 V2 分段世界',\n]) assert.ok(serverDesign.includes(text), \`服务器设计缺少 V2 持久化防回退规则: \${text}\`);\n\nconsole.log('权威热路径验证通过：按领域截止时间推进、分段存储 V2、Copy-on-Write 动作草稿、Dirty Row 持久化、纯只读状态投影、统一订单簿与六分区客户端权威状态均受防回退约束。');`,
  );
  writeFileSync(verifierPath, verifier);
}

for (const path of [
  '.github/workflows/_apply-segmented-world-storage-v2.yml',
  'scripts/.apply-segmented-world-storage-v2-coldread.mjs',
  'scripts/.apply-segmented-world-storage-v2-followup.mjs',
  'scripts/.apply-segmented-world-storage-v2.mjs',
  'scripts/.auction-hotpath-fix.mjs',
  'scripts/.authority-followup.mjs',
  'scripts/.authority-v2.mjs',
  'scripts/.commodity-cow-fix.mjs',
  'scripts/.domain-hotpath-fix.mjs',
  'scripts/.finalize-segmented-storage-design.mjs',
  'scripts/.fix-authority-eof.mjs',
  'scripts/.fix-cow-presentation-logs.mjs',
  'scripts/.fix-segmented-world-storage-v2.mjs',
  'scripts/.fix-v2-action-hotpath.mjs',
  'scripts/.leaderboard-migration-boundary-fix.mjs',
  'scripts/.projection-purity-fix.mjs',
  'scripts/.trace-daily-check-in-v2.mjs',
  'scripts/.trace-stress-catch.mjs',
  'scripts/.trace-unrelated-player.mjs',
  'scripts/.verifier-cow-wording-fix.mjs',
  'scripts/.finalize-v2-cleanup.mjs',
]) {
  if (existsSync(path)) rmSync(path);
}
