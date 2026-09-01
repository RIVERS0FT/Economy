from pathlib import Path

# Extend all audit visibility predicates to commercial counterparties, not only supply buyer/supplier columns.
p = Path('server/src/contract-audit-store.js')
text = p.read_text()
old = """  } else {
    clauses.push('(publisher_id = ? OR buyer_id = ? OR supplier_id = ?)');
    values.push(userId, userId, userId);
  }
"""
new = """  } else {
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
if old not in text:
    raise SystemExit('missing history participant visibility anchor')
text = text.replace(old, new, 1)

old = """      WHERE status NOT IN ('open', 'active')
        AND (publisher_id = ? OR buyer_id = ? OR supplier_id = ?)
      ORDER BY sort_at DESC, contract_id DESC
    `).all(userId, userId, userId);
"""
new = """      WHERE status NOT IN ('open', 'active')
        AND (
          publisher_id = ? OR buyer_id = ? OR supplier_id = ?
          OR json_extract(contract_json, '$.lenderId') = ?
          OR json_extract(contract_json, '$.borrowerId') = ?
          OR json_extract(contract_json, '$.lessorId') = ?
          OR json_extract(contract_json, '$.lesseeId') = ?
        )
      ORDER BY sort_at DESC, contract_id DESC
    `).all(userId, userId, userId, userId, userId, userId, userId);
"""
if old not in text:
    raise SystemExit('missing performance participant visibility anchor')
text = text.replace(old, new, 1)

old = """      SELECT * FROM economy_contract_audit_contracts
      WHERE contract_id = ? AND (publisher_id = ? OR buyer_id = ? OR supplier_id = ?)
    `).get(String(contractId), userId, userId, userId);
"""
new = """      SELECT * FROM economy_contract_audit_contracts
      WHERE contract_id = ? AND (
        publisher_id = ? OR buyer_id = ? OR supplier_id = ?
        OR json_extract(contract_json, '$.lenderId') = ?
        OR json_extract(contract_json, '$.borrowerId') = ?
        OR json_extract(contract_json, '$.lessorId') = ?
        OR json_extract(contract_json, '$.lesseeId') = ?
      )
    `).get(String(contractId), userId, userId, userId, userId, userId, userId, userId);
"""
if old not in text:
    raise SystemExit('missing audit detail participant visibility anchor')
text = text.replace(old, new, 1)
p.write_text(text)

# Record the visibility rule beside the history target selector rule.
p = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
text = p.read_text()
anchor = "历史查询的 `productId` 参数兼作玩家可见“合同标的”选择器：普通商品直接使用商品 ID，`credits` 只匹配玩家借贷，`facility:<facilityTypeId>` 只匹配对应工厂类型的工厂租赁；服务器必须同时约束合同领域与标的，不能把货币或工厂选择器当作商品 ID 查询，也不能只在客户端假筛选。"
addition = anchor + "\n\n合同历史、履约档案和参与者审计详情的可见性必须覆盖发布者以及采购、供货、放贷、贷款、出租、租赁全部实际参与关系；借贷和租赁的非发布方不得因为旧审计摘要表只有 `buyer_id / supplier_id` 快速列而丢失自己的记录。商业合同参与关系以不可变审计 `contract_json` 中的 `lenderId / borrowerId / lessorId / lesseeId` 与现有快速列共同判定，第三方仍返回不可见。"
if anchor not in text:
    raise SystemExit('missing selector design anchor after primary finalizer')
if '借贷和租赁的非发布方不得因为旧审计摘要表' not in text:
    text = text.replace(anchor, addition, 1)
p.write_text(text)

# Add a dynamic regression that proves counterparties, selector semantics, performance, and detail visibility.
p = Path('server/test/contract-audit.test.js')
text = p.read_text()
marker = "test('contract audit records negotiation lifecycle without exposing it through history summaries'"
if marker not in text:
    raise SystemExit('missing contract audit test insertion anchor')
new_test = r'''
test('commercial counterparties keep history performance audit access and target filters stay server authoritative', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'economy-contract-audit-targets-'));
  const store = new GameStore(path.join(directory, 'game.sqlite'));
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
    const commonTimes = [endedAt - 100_000, endedAt - 90_000, endedAt, endedAt];
    insert.run(
      'history-supply', 2, 1, 2, 'wheat', ...commonTimes,
      1, 1, 5, 2_000_000, 10_000_000, 10_000_000, 0, 10_000_000, 5, endedAt,
      JSON.stringify({ id: 'history-supply', kind: 'supply', publisherId: 2, publisherRole: 'supplier', buyerId: 1, supplierId: 2, productId: 'wheat', quantityPerDelivery: 5, unitPrice: 2, batchGross: 10, totalDeliveries: 1, completedDeliveries: 1, status: 'completed', createdAt: commonTimes[0], acceptedAt: commonTimes[1], completedAt: endedAt, endedAt }),
    );
    insert.run(
      'history-loan', 2, null, null, '', ...commonTimes,
      1, 1, 0, 0, 0, 100_000_000, 0, 100_000_000, 0, endedAt,
      JSON.stringify({ id: 'history-loan', kind: 'loan', publisherId: 2, publisherSide: 'borrower', lenderId: 1, borrowerId: 2, principal: 100, principalOutstanding: 0, interestRateBps: 500, interestDue: 0, facilityTypeId: 'farm', collateralQuantity: 1, completedDeliveries: 0, totalDeliveries: 0, status: 'completed', createdAt: commonTimes[0], acceptedAt: commonTimes[1], completedAt: endedAt, endedAt }),
    );
    insert.run(
      'history-lease', 2, null, null, '', ...commonTimes,
      2, 2, 0, 0, 0, 20_000_000, 0, 20_000_000, 0, endedAt,
      JSON.stringify({ id: 'history-lease', kind: 'facility_lease', publisherId: 2, publisherSide: 'lessor', lessorId: 2, lesseeId: 1, facilityTypeId: 'farm', quantity: 1, rentPerPeriod: 10, completedPeriods: 2, totalPeriods: 2, completedDeliveries: 0, totalDeliveries: 0, status: 'completed', createdAt: commonTimes[0], acceptedAt: commonTimes[1], completedAt: endedAt, endedAt }),
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
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

'''
if 'commercial counterparties keep history performance audit access' not in text:
    text = text.replace(marker, new_test + marker, 1)
p.write_text(text)

# Expand static audit guard for every participant relationship as a defense-in-depth check.
p = Path('scripts/verify-contract-audit.mjs')
text = p.read_text()
anchor = "includesAll(store, [\"target === 'credits'\", \"target.startsWith('facility:')\", \"json_extract(contract_json, '$.facilityTypeId') = ?\"], 'contract history server target filtering');"
addition = anchor + "\nincludesAll(store, [\"'$.lenderId'\", \"'$.borrowerId'\", \"'$.lessorId'\", \"'$.lesseeId'\"], 'commercial contract audit participant visibility');"
if anchor not in text:
    raise SystemExit('missing audit verifier target-filter anchor after primary finalizer')
if 'commercial contract audit participant visibility' not in text:
    text = text.replace(anchor, addition, 1)
p.write_text(text)
