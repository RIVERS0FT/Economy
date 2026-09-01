from pathlib import Path
import re

# Extend all audit visibility predicates to commercial counterparties, not only supply buyer/supplier columns.
p = Path('server/src/contract-audit-store.js')
text = p.read_text()

pattern = re.compile(r"  \} else \{\n    clauses\.push\('\(publisher_id = \? OR buyer_id = \? OR supplier_id = \?\)'\);\n    values\.push\(userId, userId, userId\);\n  \}\n")
replacement = """  } else {
    clauses.push(`(
      publisher_id = ? OR buyer_id = ? OR supplier_id = ?
      OR json_extract(contract_json, '$.lenderId') = ?
      OR json_extract(contract_json, '$.borrowerId') = ?
      OR json_extract(contract_json, '$.lessorId') = ?
      OR json_extract(contract_json, '$.lesseeId') = ?
    )`);
    values.push(userId, userId, userId, userId, userId, userId, userId);
  }
"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('missing history participant visibility anchor')

pattern = re.compile(r"      WHERE status NOT IN \('open', 'active'\)\n        AND \(publisher_id = \? OR buyer_id = \? OR supplier_id = \?\)\n      ORDER BY sort_at DESC, contract_id DESC\n    `\)\.all\(userId, userId, userId\);")
replacement = """      WHERE status NOT IN ('open', 'active')
        AND (
          publisher_id = ? OR buyer_id = ? OR supplier_id = ?
          OR json_extract(contract_json, '$.lenderId') = ?
          OR json_extract(contract_json, '$.borrowerId') = ?
          OR json_extract(contract_json, '$.lessorId') = ?
          OR json_extract(contract_json, '$.lesseeId') = ?
        )
      ORDER BY sort_at DESC, contract_id DESC
    `).all(userId, userId, userId, userId, userId, userId, userId);"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('missing performance participant visibility anchor')

pattern = re.compile(r"      SELECT \* FROM economy_contract_audit_contracts\n      WHERE contract_id = \? AND \(publisher_id = \? OR buyer_id = \? OR supplier_id = \?\)\n    `\)\.get\(String\(contractId\), userId, userId, userId\);")
replacement = """      SELECT * FROM economy_contract_audit_contracts
      WHERE contract_id = ? AND (
        publisher_id = ? OR buyer_id = ? OR supplier_id = ?
        OR json_extract(contract_json, '$.lenderId') = ?
        OR json_extract(contract_json, '$.borrowerId') = ?
        OR json_extract(contract_json, '$.lessorId') = ?
        OR json_extract(contract_json, '$.lesseeId') = ?
      )
    `).get(String(contractId), userId, userId, userId, userId, userId, userId, userId);"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('missing audit detail participant visibility anchor')
p.write_text(text)

# Record the visibility rule beside the selector rule injected by the primary finalizer.
p = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
text = p.read_text()
visibility_rule = "合同历史、履约档案和参与者审计详情的可见性必须覆盖发布者以及采购、供货、放贷、贷款、出租、租赁全部实际参与关系；借贷和租赁的非发布方不得因为旧审计摘要表只有 `buyer_id / supplier_id` 快速列而丢失自己的记录。商业合同参与关系以不可变审计 `contract_json` 中的 `lenderId / borrowerId / lessorId / lesseeId` 与现有快速列共同判定，第三方仍返回不可见。"
if visibility_rule not in text:
    selector = "历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器：普通商品直接使用商品 ID，`credits` 只匹配玩家借贷，`facility:<facilityTypeId>` 只匹配对应工厂类型的工厂租赁；服务器必须同时约束合同领域与标的，不能把货币或工厂选择器当作商品 ID 查询，也不能只在客户端假筛选。"
    if selector in text:
        text = text.replace(selector, selector + '\n\n' + visibility_rule, 1)
    else:
        text += '\n\n' + visibility_rule + '\n'
p.write_text(text)

# Add a dynamic regression that proves counterparties, selector semantics, performance, and detail visibility.
p = Path('server/test/contract-audit.test.js')
text = p.read_text()
if "import { mkdtempSync, rmSync } from 'node:fs';" not in text:
    text = text.replace("import { rmSync } from 'node:fs';", "import { mkdtempSync, rmSync } from 'node:fs';", 1)
new_test = r'''

test('commercial counterparties keep history performance audit access and target filters stay server authoritative', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-contract-audit-targets-'));
  const store = new EconomyStore(join(directory, 'game.sqlite'), { scheduledProcessing: false });
  try {
    const insert = store.database.prepare(`
      INSERT INTO economy_contract_audit_contracts (
        contract_id, publisher_id, buyer_id, supplier_id, product_id, status,
        audit_completeness, created_at, accepted_at, ended_at, sort_at,
        completed_deliveries, total_deliveries, quantity_per_delivery, unit_price,
        batch_gross, gross_total, fee_total, net_total, transferred_goods,
        compensation_total, last_event_sequence, last_event_at, contract_json, money_precision_version
      ) VALUES (?, ?, ?, ?, ?, 'completed', 'full', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, 2)
    `);
    const endedAt = Date.now() - 10_000;
    const createdAt = endedAt - 100_000;
    const acceptedAt = endedAt - 90_000;
    const commonTimes = [createdAt, acceptedAt, endedAt, endedAt];
    insert.run(
      'history-supply', 2, 1, 2, 'wheat', ...commonTimes,
      1, 1, 5, 2_000_000, 10_000_000, 10_000_000, 0, 10_000_000, 5, endedAt,
      JSON.stringify({ id: 'history-supply', kind: 'supply', publisherId: 2, publisherRole: 'supplier', buyerId: 1, supplierId: 2, productId: 'wheat', quantityPerDelivery: 5, unitPrice: 2, batchGross: 10, totalDeliveries: 1, completedDeliveries: 1, status: 'completed', createdAt, acceptedAt, completedAt: endedAt, endedAt }),
    );
    insert.run(
      'history-loan', 2, null, null, '', ...commonTimes,
      1, 1, 0, 0, 0, 100_000_000, 0, 100_000_000, 0, endedAt,
      JSON.stringify({ id: 'history-loan', kind: 'loan', publisherId: 2, publisherSide: 'borrower', lenderId: 1, borrowerId: 2, principal: 100, principalOutstanding: 0, interestRateBps: 500, interestDue: 0, facilityTypeId: 'farm', collateralQuantity: 1, completedDeliveries: 0, totalDeliveries: 0, status: 'completed', createdAt, acceptedAt, completedAt: endedAt, endedAt }),
    );
    insert.run(
      'history-lease', 2, null, null, '', ...commonTimes,
      2, 2, 0, 0, 0, 20_000_000, 0, 20_000_000, 0, endedAt,
      JSON.stringify({ id: 'history-lease', kind: 'facility_lease', publisherId: 2, publisherSide: 'lessor', lessorId: 2, lesseeId: 1, facilityTypeId: 'farm', quantity: 1, rentPerPeriod: 10, completedPeriods: 2, totalPeriods: 2, completedDeliveries: 0, totalDeliveries: 0, status: 'completed', createdAt, acceptedAt, completedAt: endedAt, endedAt }),
    );

    const user = { id: 1 };
    assert.deepEqual(store.listContractAuditHistory(user, { productId: 'wheat' }).items.map((item) => item.id), ['history-supply']);
    assert.deepEqual(store.listContractAuditHistory(user, { productId: 'credits' }).items.map((item) => item.id), ['history-loan']);
    assert.deepEqual(store.listContractAuditHistory(user, { productId: 'facility:farm' }).items.map((item) => item.id), ['history-lease']);
    assert.deepEqual(new Set(store.listContractAuditHistory(user).items.map((item) => item.id)), new Set(['history-supply', 'history-loan', 'history-lease']));
    assert.equal(store.getContractPerformance(user).totalEnded, 3);
    assert.equal(store.getContractAuditDetail(user, 'history-loan').contract.isLender, true);
    assert.throws(() => store.getContractAuditDetail({ id: 999 }, 'history-loan'), /合同审计记录不存在/);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
'''
if 'commercial counterparties keep history performance audit access' not in text:
    text += new_test
p.write_text(text)

# Expand static audit guard for every participant relationship as defense in depth.
p = Path('scripts/verify-contract-audit.mjs')
text = p.read_text()
line = "includesAll(store, [\"'$.lenderId'\", \"'$.borrowerId'\", \"'$.lessorId'\", \"'$.lesseeId'\"], 'commercial contract audit participant visibility');"
if line not in text:
    marker = 'if (failures.length) {'
    if marker not in text:
        raise SystemExit('missing audit verifier final marker')
    text = text.replace(marker, line + '\n\n' + marker, 1)
p.write_text(text)
