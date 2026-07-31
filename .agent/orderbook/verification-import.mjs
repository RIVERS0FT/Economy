import { replaceExact } from './helpers.mjs';

replaceExact(
  'scripts/verify-order-matching-core.mjs',
  "import { getOrderBookSide, recordOrderBookVisit } from './order-book-runtime.js'",
  "import { getOrderBookSide, recordOrderBookReduction, recordOrderBookVisit } from './order-book-runtime.js'",
);
