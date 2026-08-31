from pathlib import Path

commercial = Path('server/src/commercial-contracts.js')
text = commercial.read_text(encoding='utf-8')
target = "    publisherName: String(contract?.publisherName || '玩家'),\n"
if text.count(target) != 1:
    raise SystemExit(f'expected one residual publisherName normalizer, got {text.count(target)}')
commercial.write_text(text.replace(target, '', 1), encoding='utf-8')

verifier = Path('scripts/verify-runtime-efficiency.mjs')
text = verifier.read_text(encoding='utf-8')
marker = "assert.equal(read('server/src/asset-auctions.js').includes('sellerName: playerName(world'), false, '玩家拍卖持久化不得复制卖方昵称');\n"
addition = marker + "assert.equal(read('server/src/commercial-contracts.js').includes(\"publisherName: String(contract?.publisherName || '玩家')\"), false, '玩家借贷与租赁 normalizer 不得合成关系名称字段');\n"
if text.count(marker) != 1:
    raise SystemExit('verifier insertion marker mismatch')
verifier.write_text(text.replace(marker, addition, 1), encoding='utf-8')

test_path = Path('server/test/player-id-reference.test.js')
text = test_path.read_text(encoding='utf-8')
addition = '''

test('commercial lease normalization does not synthesize player name fields', () => {
  const state = createWorld(1_000);
  addPlayer(state, 1, '出租方');
  addPlayer(state, 2, '承租方');
  const facility = FACILITY_TYPE_CATALOG[0];
  const contract = normalizeCommercialContract({
    id: 'lease-1', kind: 'facility_lease', publisherSide: 'lessor', publisherId: 1,
    lessorId: 1, lesseeId: 2, provinceId: '110000', facilityTypeId: facility.id,
    quantity: 1, rentPerPeriod: 10, periodMs: 24 * 60 * 60 * 1000, totalPeriods: 2,
    firstPeriodDelayMs: 0, status: 'active', createdAt: 1_000, acceptedAt: 1_100, nextDueAt: 2_000,
  });
  assert.equal(Object.hasOwn(contract, 'publisherName'), false);
  assert.equal(Object.hasOwn(contract, 'lessorName'), false);
  assert.equal(Object.hasOwn(contract, 'lesseeName'), false);
  const view = publicCommercialContract(state, contract, 1);
  assert.equal(view.publisherName, '出租方');
  assert.equal(view.lessorName, '出租方');
  assert.equal(view.lesseeName, '承租方');
});
'''
if 'commercial lease normalization does not synthesize player name fields' in text:
    raise SystemExit('lease regression already exists')
test_path.write_text(text.rstrip() + addition, encoding='utf-8')
