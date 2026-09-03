import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
const source = readFileSync(path, 'utf8');
const required = '旧有限批次商品合同的宽限结束只确认违约：服务器只写入违约责任与 `breachedAt`，停止后续自动履约并进入“已违约待解除”；与赔偿无关的托管资金、商品和无责方保证金按权威规则释放，责任方保证金或抵押继续冻结等待受偿方处理。已违约待解除合同不得通过事后补货、补款、还款、自动准备、自动补款、续签或恢复履约重新激活；受偿玩家必须再执行既有解除／领取动作完成赔付或抵押处置。该两阶段状态机属于既有合同权威边界，本次商品市场改为每日官方价即时交易不得改变。';
let next = source;
if (!next.includes('宽限结束只确认违约') || !next.includes('已违约待解除')) {
  const anchor = '普通玩家合同页只读取历史终态摘要，不读取审计事件时间线。';
  if (!next.includes(anchor)) throw new Error('找不到合同设计插入锚点');
  next = next.replace(anchor, `${required}\n\n${anchor}`);
  writeFileSync(path, next.endsWith('\n') ? next : `${next}\n`);
}
for (const temp of ['scripts/codex-restore-contract-default-design.mjs', '.github/workflows/codex-restore-contract-default-design.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
