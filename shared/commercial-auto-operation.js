/** @typedef {{ enabled: boolean, inputCoverageCycles: 1 | 2 | 3 | 5 }} CommercialAutoOperationPolicy */

/** @type {Readonly<CommercialAutoOperationPolicy>} */
export const DEFAULT_COMMERCIAL_AUTO_OPERATION_POLICY = Object.freeze({ enabled: true, inputCoverageCycles: 2 });

/** @param {unknown} value @returns {CommercialAutoOperationPolicy | null} */
export function normalizeCommercialAutoOperationPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const policy = /** @type {Record<string, unknown>} */ (value);
  if (typeof policy.enabled !== 'boolean' || ![1, 2, 3, 5].includes(/** @type {number} */ (policy.inputCoverageCycles))) return null;
  return { enabled: policy.enabled, inputCoverageCycles: /** @type {1 | 2 | 3 | 5} */ (policy.inputCoverageCycles) };
}

/** @param {{autoOperationPolicy?: unknown} | null | undefined} group @returns {Readonly<CommercialAutoOperationPolicy>} */
export function commercialAutoOperationPolicyFor(group) {
  return normalizeCommercialAutoOperationPolicy(group?.autoOperationPolicy) ?? DEFAULT_COMMERCIAL_AUTO_OPERATION_POLICY;
}
