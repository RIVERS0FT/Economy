from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/pages/ContractPage.tsx',
    "        await model.refresh({ mode: 'authoritative' });",
    "        void model.refresh({ mode: 'authoritative' });",
)

replace_once(
    'server/test/world-storage-v2.test.js',
    """  const error = assert.throws(() => createRuntimeMutationScope(
    world,
    1,
    'futureUnregisteredAction',
    {},
    { scheduledProcessing: true },
  ));
  assert.equal(error.code, 'INTERACTIVE_ACTION_SCOPE_UNDECLARED');
  assert.equal(error.statusCode, 500);
""",
    """  assert.throws(
    () => createRuntimeMutationScope(
      world,
      1,
      'futureUnregisteredAction',
      {},
      { scheduledProcessing: true },
    ),
    { code: 'INTERACTIVE_ACTION_SCOPE_UNDECLARED', statusCode: 500 },
  );
""",
)

replace_once(
    'server/test/world-storage-v2.test.js',
    """  const error = assert.throws(() => createRuntimeMutationScope(world, 1, 'placeOrder', {
    execution: 'future-unregistered-execution',
    productId: 'wheat',
    side: 'buy',
    price: 10,
    quantity: 1,
  }, { scheduledProcessing: true }));
  assert.equal(error.code, 'ORDER_EXECUTION_UNREGISTERED');
  assert.equal(error.statusCode, 400);
""",
    """  assert.throws(
    () => createRuntimeMutationScope(world, 1, 'placeOrder', {
      execution: 'future-unregistered-execution',
      productId: 'wheat',
      side: 'buy',
      price: 10,
      quantity: 1,
    }, { scheduledProcessing: true }),
    { code: 'ORDER_EXECUTION_UNREGISTERED', statusCode: 400 },
  );
""",
)

print('generated guardrail tests fixed')
